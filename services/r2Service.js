/**
 * R2 Download URL Service
 *
 * Purpose:
 * - Generates time-limited, user-unique download URLs for private R2 game files
 * - URLs are authenticated by the Cloudflare Worker using HMAC-SHA256
 * - No AWS SDK or SigV4 needed — uses Node.js built-in `crypto`
 *
 * URL format:
 *   https://<WORKER_DOMAIN>/download?key=<objectKey>&expires=<unixTimestamp>&token=<hmac>
 *
 * The Cloudflare Worker at WORKER_DOMAIN validates the token and streams the file from R2.
 *
 * Environment Variables Required:
 * - WORKER_SECRET → Shared secret between this bot and the Cloudflare Worker
 *                   Set in bot .env AND in Cloudflare via `wrangler secret put WORKER_SECRET`
 * - WORKER_DOMAIN → Domain where the Worker is deployed (e.g. files.imlur.com)
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const { EVENTS } = require('../config/events');
const { DOWNLOAD_EXPIRY_SECONDS } = require('../config/constants');

/**
 * Generates a time-limited HMAC-authenticated download URL for a private R2 object.
 * The URL is routed through the Cloudflare Worker which validates the token and
 * streams the file directly from R2 to the user's browser.
 *
 * @param {string} objectKey     - R2 object key (e.g. "gta-vc/GTA_ViceCity_Setup.zip")
 * @param {string} userId        - Discord user ID (used only for audit logging)
 * @param {string} username      - Discord username (used only for audit logging)
 * @param {number} [expirySeconds] - Override default expiry (optional)
 *
 * @returns {string} Authenticated download URL valid for expirySeconds
 */
function generateDownloadUrl(objectKey, userId, username, expirySeconds = DOWNLOAD_EXPIRY_SECONDS) {
  const workerSecret = process.env.WORKER_SECRET;
  const workerDomain = process.env.WORKER_DOMAIN || 'files.imlur.com';

  if (!workerSecret) {
    throw new Error('WORKER_SECRET environment variable is not set');
  }

  // Expiry = current Unix timestamp + window
  const expires = Math.floor(Date.now() / 1000) + expirySeconds;

  // HMAC-SHA256(secret, "objectKey:expires") — same computation as the Worker
  const message = `${objectKey}:${expires}`;
  const token   = crypto.createHmac('sha256', workerSecret).update(message).digest('hex');

  const url = new URL(`https://${workerDomain}/download`);
  url.searchParams.set('key',     objectKey);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('token',   token);

  logger.info(EVENTS.REWARD_SIGNED_URL_GENERATED, {
    userId,
    username,
    objectKey,
    expirySeconds
  });

  return url.toString();
}

module.exports = { generateDownloadUrl };
