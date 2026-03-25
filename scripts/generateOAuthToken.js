/**
 * OAuth2 Token Generator (One-Time Setup)
 *
 * Purpose:
 * - Performs the one-time OAuth2 authorization flow to obtain a refresh token.
 * - The refresh token is what allows the bot to post YouTube comments on behalf
 *   of your channel without requiring manual login each time.
 *
 * Prerequisites:
 * - YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env
 * - Your GCP OAuth2 client must have http://localhost as an authorized redirect URI
 *
 * Usage:
 *   node scripts/generateOAuthToken.js
 *
 * Steps:
 * 1. Run this script — it prints an authorization URL
 * 2. Open the URL in your browser
 * 3. Grant the requested permissions for your channel
 * 4. Copy the `code` query parameter from the redirect URL
 * 5. Paste it into the terminal when prompted
 * 6. The script prints your refresh token — copy it to .env as YOUTUBE_REFRESH_TOKEN
 *
 * Security Note:
 * - The refresh token grants write access to your YouTube channel.
 * - Never commit it to version control.
 * - This script only needs to be run once. Re-run only if the token is revoked.
 */

require('../config/env');

const { google } = require('googleapis');
const readline = require('readline');

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;

if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error('[Error] YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env before running this script.');
  process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const REDIRECT_URI = 'http://localhost';

const oauth2Client = new google.auth.OAuth2(
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  REDIRECT_URI
);

// Generate the authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Required to receive a refresh token
  scope: SCOPES,
  prompt: 'consent'       // Forces refresh token to be returned even if previously granted
});

console.log('\n──────────────────────────────────────────────────');
console.log('YouTube OAuth2 Token Generator');
console.log('──────────────────────────────────────────────────');
console.log('\nStep 1: Open this URL in your browser and grant access:\n');
console.log(authUrl);
console.log('\nStep 2: After granting access, you will be redirected to localhost.');
console.log('        Copy the full redirect URL or just the "code" query parameter.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Paste the authorization code here: ', async (input) => {
  rl.close();

  // Extract just the code in case the user pastes the full redirect URL
  let code = input.trim();
  try {
    const url = new URL(code);
    code = url.searchParams.get('code') || code;
  } catch {
    // Not a URL — treat as raw code directly
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('\n[Error] No refresh token received.');
      console.error('This usually means the account has already granted access previously.');
      console.error('Go to https://myaccount.google.com/permissions, revoke access for this app, then re-run this script.');
      process.exit(1);
    }

    console.log('\n──────────────────────────────────────────────────');
    console.log('Success! Add this to your .env file:');
    console.log('──────────────────────────────────────────────────\n');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('Keep this value secret and never commit it to version control.');
  } catch (err) {
    console.error('\n[Error] Failed to exchange authorization code for tokens:');
    console.error(err.message);
    process.exit(1);
  }
});
