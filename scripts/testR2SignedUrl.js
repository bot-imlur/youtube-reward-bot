/**
 * Test Script: Worker Download URL Generation
 *
 * Usage:
 *   node scripts/testR2SignedUrl.js
 *
 * Requires in .env:
 *   WORKER_SECRET=<your secret>
 *   WORKER_DOMAIN=files.imlur.com   (optional, defaults to files.imlur.com)
 *
 * What it does:
 * 1. Generates a 1-minute expiry HMAC download URL
 * 2. Writes it to signed-url.txt
 * 3. You paste the URL in your browser → should download the file
 * 4. Wait 1 minute → paste again → should return "This download link has expired"
 */

require('dotenv').config();
const fs = require('fs');
const { generateDownloadUrl } = require('../services/r2Service');
const { GAME_CONFIG } = require('../config/constants');

const testObjectKey = process.env.TEST_OBJECT_KEY
  || Object.values(GAME_CONFIG).find(g => g.reward)?.reward;

if (!testObjectKey) {
  console.error('[Test] No reward object key found in GAME_CONFIG and TEST_OBJECT_KEY not set.');
  process.exit(1);
}

console.log('[Test] Generating download URL...');
console.log(`[Test] Object key: ${testObjectKey}`);

try {
  const url = generateDownloadUrl(testObjectKey, 'test-user-123'); // 30 minutes (production default)

  fs.writeFileSync('signed-url.txt', url, 'utf8');
  console.log('\n✅ Download URL written to: signed-url.txt\n');

  const parsed = new URL(url);
  const expires = parsed.searchParams.get('expires');
  const expiresDate = new Date(parseInt(expires) * 1000).toLocaleTimeString();

  console.log('─── URL Breakdown ───────────────────────────────────');
  console.log(`Host    : ${parsed.host}`);
  console.log(`Path    : ${parsed.pathname}`);
  console.log(`Key     : ${parsed.searchParams.get('key')}`);
  console.log(`Expires : ${expiresDate} (30 minutes from now)`);
  console.log(`Token   : ${parsed.searchParams.get('token')?.slice(0, 16)}...`);
  console.log('─────────────────────────────────────────────────────');
  console.log('\nNext steps:');
  console.log('  1. Paste the URL from signed-url.txt into your browser → file should download');
  console.log('  2. Wait 1 minute → paste again → should show "This download link has expired"');
} catch (err) {
  console.error('\n❌ Error:', err.message);
  if (err.message.includes('WORKER_SECRET')) {
    console.error('\nAdd WORKER_SECRET to your .env file first.');
  }
  process.exit(1);
}
