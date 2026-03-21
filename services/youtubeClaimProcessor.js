/**
 * YouTube Claim Processor
 *
 * Purpose:
 * - Processes YouTube comments for a specific GAME
 * - Extracts codes, validates them, and prepares rewards
 *
 * Rules:
 * - Each GAME maps to exactly one VIDEO
 * - Only comments from that video are processed
 * - Code must belong to the SAME game (enforced in service)
 *
 * Flow:
 * 1. Normalize and validate game
 * 2. Resolve videoId from GAME_CONFIG
 * 3. Initialize per-video store
 * 4. Fetch comments
 * 5. Skip already processed comments
 * 6. Parse → validate (includes consume)
 * 7. Save comment lifecycle
 * 8. Return reward-ready results
 */

const { fetchComments } = require('./youtubeCommentService');
const { parseComment } = require('../utils/commentParser');
const { validateCode, consumeCode } = require('./claimRewardService');
const { getRewardForGame} = require('../utils/validationUtils');
const { initStore, isProcessed, saveComment } = require('../utils/commentStore');
const { GAME_CONFIG } = require('../config/constants');
const { CLAIM_RESULT } = require('../config/claimResult');

/**
 * Processes YouTube comments for a given game
 *
 * @param {string} rawGame
 * @returns {Promise<Array>}
 */
async function processComments(game) {
  if (!game || !GAME_CONFIG[game]?.enabled) {
    throw new Error(`Invalid or disabled game: ${game}`);
  }

  const { videoId, videoName } = GAME_CONFIG[game];

  // Initialize store (per video)
  await initStore(videoId, videoName, game);

  // Fetch comments from this game's video
  const comments = await fetchComments(videoId);

  const results = [];

  for (const comment of comments) {
    const { id, text } = comment;

    if (!id) {
      console.warn(
        "[YouTube][INVALID_COMMENT_ID]",
        { comment, game, videoId }
      );
      continue;
    }

    // Skip already processed comments
    if (await isProcessed(videoId, id)) {
      continue;
    }

    // Parse comment
    const parsed = parseComment(text);

    let validation = {
      success: false,
      reason: CLAIM_RESULT.PARSE_FAILED
    };

    if (parsed) {
      // Step 1: Validate the code
      validation = await validateCode(parsed.code, game);

      // Ensure validation always has a reason
      if (!validation.reason) {
        validation.reason = CLAIM_RESULT.UNKNOWN;
      }

      // Step 2: If validation succeeded, consume the code
      if (validation.success) {
        const consumeResult = await consumeCode(parsed.code);
        if (consumeResult.success) {
          const reward = getRewardForGame(game);

          results.push({
            code: parsed.code,
            userId: validation.userId,
            game,
            reward
          });
        }
      }
    }

    // Save comment lifecycle
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