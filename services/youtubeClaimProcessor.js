/**
 * YouTube Claim Processor
 *
 * Purpose:
 * - Processes YouTube comments for a specific GAME
 * - Extracts codes and validates them, then persists results to the comment store
 *
 * Design:
 * - Does NOT consume codes. Consumption is the caller's responsibility.
 *   This ensures only the user who runs /claim has their code consumed,
 *   not every user whose comment happened to be fetched in the same batch.
 * - Safe to call from a scheduler — it will never silently consume other users' codes.
 *
 * Rules:
 * - Each GAME maps to exactly one VIDEO
 * - Only comments from that video are processed
 * - Code must belong to the SAME game (enforced by validateCode)
 *
 * Flow:
 * 1. Normalize and validate game
 * 2. Resolve videoId from GAME_CONFIG
 * 3. Initialize per-video store
 * 4. Fetch all top-level comments
 * 5. Skip already processed comments
 * 6. Parse → validate → save result
 * 7. Return validation-ready results (no consumption)
 */

const { fetchComments } = require('./youtubeCommentService');
const { parseComment } = require('../utils/commentParser');
const { validateCode } = require('./claimRewardService');
const { initStore, isProcessed, saveComment } = require('../utils/commentStore');
const { GAME_CONFIG } = require('../config/constants');
const { CLAIM_RESULT } = require('../config/claimResult');
const logger = require('../utils/logger');

/**
 * Fetches and validates YouTube comments for a given game, persisting each result
 * to the per-video comment store. Does NOT consume any codes.
 *
 * @param {string} game - Normalized game key (e.g. "GTA-VC")
 * @returns {Promise<Array<{ code: string, userId: string, game: string }>>}
 *   List of comments that passed validation (caller decides whether to consume).
 */
async function processComments(game) {
  if (!game || !GAME_CONFIG[game]?.enabled) {
    throw new Error(`Invalid or disabled game: ${game}`);
  }

  const { videoId, videoName } = GAME_CONFIG[game];

  // Initialize store (per video) — no-op if already exists
  await initStore(videoId, videoName, game);

  // Fetch top-level comments from this game's video
  const comments = await fetchComments(videoId);

  const results = [];

  for (const comment of comments) {
    const { id, text } = comment;

    if (!id) {
      logger.warn('INVALID_COMMENT_ID', { comment, game, videoId });
      continue;
    }

    // Skip already processed comments — their results are already in the store
    if (await isProcessed(videoId, id)) {
      continue;
    }

    // Parse comment into { username, code }
    const parsed = parseComment(text);

    let validation = {
      success: false,
      reason: CLAIM_RESULT.PARSE_FAILED
    };

    if (parsed) {
      // Validate the code (checks existence, used, expired, game match)
      // Does NOT consume — consumeCode is intentionally not called here
      validation = await validateCode(parsed.code, game);

      if (!validation.reason) {
        validation.reason = CLAIM_RESULT.UNKNOWN;
      }

      // Collect validated (but unconsumed) results for the caller to act on
      if (validation.success) {
        results.push({
          code: parsed.code,
          userId: validation.userId,
          game
        });
      }
    }

    // Persist comment lifecycle regardless of outcome
    await saveComment(videoId, id, {
      raw: text,
      parsed,
      validation,
      meta: {
        processedAt: Date.now()
      }
    });
  }

  return results;
}

module.exports = {
  processComments
};