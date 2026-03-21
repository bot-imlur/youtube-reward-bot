/**
 * YouTube Comment Service
 *
 * Purpose:
 * - Fetch top-level comments from a YouTube video (read, API key auth).
 * - Reply to a specific comment on behalf of the channel (write, OAuth2 auth).
 *
 * Authentication:
 * - fetchComments → API key (YOUTUBE_API_KEY). Public, read-only.
 * - replyToComment → OAuth2 (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET,
 *   YOUTUBE_REFRESH_TOKEN). Requires write scope on the channel.
 *   OAuth2 client is initialised lazily — missing credentials do NOT affect fetchComments.
 *
 * Current Implementation:
 * - fetchComments fetches only page 1 (up to 50 comments), ordered by time (newest first).
 * - replyToComment uses comments.insert with parentId to post a channel reply.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * KNOWN LIMITATIONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Single-page fetch (50 comments max per call)
 *    - Only page 1 is fetched. Comments pushed past position 50 by newer ones
 *      will not be seen until a scheduler or the next /claim run catches them.
 *    - Future improvement: paginated fetch with early exit when an entire page
 *      is already in the comment store, with a configurable MAX_PAGES cap.
 *
 * 2. Edge case — high comment volume between scheduler runs
 *    - If more than 50 comments arrive between runs, older ones in that batch
 *      are missed until the next cycle. Acceptable at current traffic levels.
 *
 * 3. YouTube API quota (free tier: 10,000 units/day)
 *    - fetchComments costs 1 unit per call. replyToComment costs 50 units per call.
 *    - At low traffic this is not a concern. Monitor in GCP Console if volume grows.
 *
 * 4. No retry logic on transient failures
 *    - Network or API errors surface to the caller. fetchComments failures abort
 *      the /claim processor. replyToComment failures are fire-and-forget (logged only).
 *    - Future improvement: exponential backoff retry via axios-retry / googleapis retry.
 *
 * 5. Deleted or spam-held comments are invisible
 *    - YouTube does not surface comments held for review. No bot-side mitigation.
 *
 * 6. OAuth2 token scope
 *    - replyToComment requires the youtube.force-ssl scope. This scope must be
 *      granted during the one-time token generation step (scripts/generateOAuthToken.js).
 *    - If the channel is not verified or has posting restrictions, replies will fail.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE IMPROVEMENTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * - Paginated fetch with early exit and MAX_PAGES cap.
 * - Retry logic for transient API failures.
 * - Track lastFetchedAt per video and use publishedAfter to only fetch new comments.
 * - Configurable reply message per game via GAME_CONFIG.
 */

const axios = require('axios');
const { google } = require('googleapis');
const logger = require('../utils/logger');

const API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Reply text posted to YouTube after a successful reward.
 * Intentionally short and professional — no sensitive info.
 */
const REWARD_REPLY_MESSAGE = 'Your reward has been sent to your Discord DM. Thanks for participating!';

// ─── Read Auth ────────────────────────────────────────────────────────────────

/**
 * Fetches the most recent top-level comments from a YouTube video.
 *
 * Returns up to 50 comments ordered by time (newest first).
 * Requires only a public API key — no OAuth needed.
 *
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Array<{ id: string, text: string }>>}
 * @throws {Error} If the YouTube API call fails
 */
async function fetchComments(videoId) {
  const url = 'https://www.googleapis.com/youtube/v3/commentThreads';

  let response;
  try {
    response = await axios.get(url, {
      params: {
        part: 'snippet',
        videoId,
        key: API_KEY,
        maxResults: 50,
        order: 'time' // Newest first — maximises chance of finding recent reward comments on page 1
      }
    });
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    logger.error('YOUTUBE_API_FETCH_FAILED', { videoId, status, message });
    throw new Error(`YouTube API request failed (${status ?? 'network error'}): ${message}`);
  }

  return response.data.items.map(item => ({
    id: item.id,
    text: item.snippet.topLevelComment.snippet.textDisplay
  }));
}

// ─── Write Auth (OAuth2) ──────────────────────────────────────────────────────

/**
 * Cached YouTube OAuth2 client — initialised once on first replyToComment call.
 * The googleapis library automatically refreshes the access token using the
 * stored refresh_token, so this instance is safe to reuse indefinitely.
 */
let _youtubeOAuthClient = null;

/**
 * Returns the singleton YouTube OAuth2 client, creating it on first call.
 * The googleapis library automatically refreshes the access token using the
 * stored refresh_token, so this instance is safe to reuse indefinitely.
 *
 * @returns {import('googleapis').youtube_v3.Youtube}
 * @throws {Error} If any required OAuth credential is missing
 */
function getYouTubeOAuthClient() {
  if (_youtubeOAuthClient) return _youtubeOAuthClient;

  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;

  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error(
      'YouTube OAuth credentials are not configured. ' +
      'Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in .env. ' +
      'Run scripts/generateOAuthToken.js to obtain a refresh token.'
    );
  }

  const auth = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });

  _youtubeOAuthClient = google.youtube({ version: 'v3', auth });
  return _youtubeOAuthClient;
}

/**
 * Posts a reply to a YouTube comment thread on behalf of the channel.
 *
 * Non-blocking by design — callers should use fire-and-forget:
 *   replyToComment(commentId, text).catch(err => logger.warn(...))
 *
 * Uses the REWARD_REPLY_MESSAGE constant if no text is provided.
 *
 * @param {string} commentId - YouTube commentThread ID to reply to (parentId)
 * @param {string} [replyText=REWARD_REPLY_MESSAGE] - Text of the reply
 * @returns {Promise<void>}
 * @throws {Error} If OAuth is misconfigured or the API call fails
 */
async function replyToComment(commentId, replyText = REWARD_REPLY_MESSAGE) {
  const youtube = getYouTubeOAuthClient();

  await youtube.comments.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        parentId: commentId,  // commentThread ID — not individual comment ID
        textOriginal: replyText
      }
    }
  });
}

module.exports = {
  fetchComments,
  replyToComment,
  REWARD_REPLY_MESSAGE
};