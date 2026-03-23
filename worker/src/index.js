/**
 * Cloudflare Worker — R2 Download Gateway
 *
 * Serves private R2 game files via time-limited, user-unique HMAC-authenticated URLs.
 *
 * URL format:
 *   https://files.imlur.com/download?key=<objectKey>&expires=<unixTimestamp>&token=<hmac>
 *
 * Security:
 * - HMAC-SHA256 token signed with WORKER_SECRET (set via `wrangler secret put WORKER_SECRET`)
 * - Expiry enforced server-side (Unix timestamp)
 * - Bucket stays private — only this Worker can read from it
 *
 * Bindings required (set in wrangler.toml):
 * - env.R2_BUCKET  → R2 bucket binding
 * - env.WORKER_SECRET → Secret set via `wrangler secret put WORKER_SECRET`
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only handle /download path
    if (url.pathname !== '/download') {
      return new Response('Not Found', { status: 404 });
    }

    const key     = url.searchParams.get('key');
    const expires = url.searchParams.get('expires');
    const token   = url.searchParams.get('token');

    // All parameters required
    if (!key || !expires || !token) {
      return new Response('Missing required parameters', { status: 400 });
    }

    // Check expiry before doing any crypto
    const expiresAt = parseInt(expires, 10);
    if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
      return new Response('This download link has expired', { status: 403 });
    }

    // Validate HMAC token
    const expectedToken = await computeHmac(env.WORKER_SECRET, `${key}:${expires}`);
    if (!timingSafeEqual(token, expectedToken)) {
      return new Response('Invalid token', { status: 403 });
    }

    // Fetch object from R2
    const object = await env.R2_BUCKET.get(key);
    if (!object) {
      return new Response('File not found', { status: 404 });
    }

    // Build response headers
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    headers.set('Cache-Control', 'no-store'); // Never cache — links are single-use per user

    return new Response(object.body, { status: 200, headers });
  }
};

/**
 * Compute HMAC-SHA256 of data using secret, return hex string.
 * Uses Web Crypto API (available in all Cloudflare Workers runtimes).
 */
async function computeHmac(secret, data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
