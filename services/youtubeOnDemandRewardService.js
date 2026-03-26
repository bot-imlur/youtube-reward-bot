/**
 * YouTube On-Demand Reward Service
 *
 * Responsibility:
 * - Handle /yt command logic
 * - Coordinate between code store and YouTube comment store
 * - Orchestrate YouTube processing when needed
 *
 * Logic Flow:
 * 1. Check if user has code for game
 * 2. If NO code → Error: "Please run /claim first"
 * 3. If code exists AND used → Error: "Already claimed"
 * 4. If code exists AND expired → Error: "Code expired, run /claim again"
 * 5. If code exists AND NOT used AND NOT expired:
 *    a. Search YouTube comment store for latest successful validation
 *    b. If found → Return reward (mark code as used)
 *    c. If not found → Run processor & recheck
 *       - If found → Return reward (mark code as used)
 *       - If not found → Show reason why verification failed
 */

const path = require('path');
const { getCodesReader } = require('../utils/codeReader');
const {
  findCodeInCommentStore
} = require('../utils/youtubeLookup');
const { processComments } = require('./youtubeClaimProcessor');
const { getRewardForGame } = require('../utils/validationUtils');
const { generateDownloadUrl } = require('./r2Service');
const { isExpired } = require('../utils/expiryUtils');
const { consumeCode } = require('./claimRewardService');
const { replyToComment } = require('./youtubeCommentService');
const { CODES_FILE_PATH, GAME_CONFIG } = require('../config/constants');
const { getHumanReadableReason } = require('../config/claimResult');
const { EVENTS } = require('../config/events');
const logger = require('../utils/logger');

/**
 * Check YouTube comment store for successful validation and consume code if valid
 * Extracted to avoid code duplication
 *
 * @param {string} videoId
 * @param {string} code
 * @param {string} game
 * @param {string} username
 * @returns {Promise<{found: boolean, consumed: boolean, reward?: string, reason?: string}>}
 */
async function checkAndConsumeValidatedCode(videoId, code, game, username) {
  const codeData = findCodeInCommentStore(videoId, code);

  if (!codeData) {
    return {
      found: false,
      consumed: false,
      reason: 'Comment with code not found in YouTube'
    };
  }

  // Comment found — check if validation succeeded
  if (codeData.validation && codeData.validation.success === true) {
    const consumeResult = await consumeCode(code);

    if (consumeResult.success) {
      const reward = getRewardForGame(game);
      const signedUrl = generateDownloadUrl(reward, codeData.validation.userId, username);

      logger.info(EVENTS.REWARD_SENT, {
        code,
        userId: codeData.validation.userId,
        game,
        reward,
        commentId: codeData.commentId
      });

      // Fire-and-forget: reply to the YouTube comment to acknowledge the reward
      // Failure here must never block reward delivery — logged as warning only
      replyToComment(codeData.commentId)
        .then(() => logger.info(EVENTS.REWARD_REPLY_POSTED, { commentId: codeData.commentId }))
        .catch(err =>
          logger.warn('YOUTUBE_REPLY_FAILED', { commentId: codeData.commentId, error: err.message })
        );

      return {
        found: true,
        consumed: true,
        reward: signedUrl
      };
    }
  }

  // Comment found but validation failed — return the reason
  const reason = codeData.validation?.reason || 'Unknown validation error';
  return {
    found: true,
    consumed: false,
    reason
  };
}

/**
 * Process /yt command for a user
 *
 * @param {Client} client - Discord client instance
 * @param {string} userId - Discord user ID
 * @param {string} game - Normalized game name (e.g., "GTA-VC")
 * @returns {Promise<{success: boolean, gameFullName: string, isError: boolean, reason?: string, reward?: string}>}
 */
async function processYouTubeRewardCommand(client, userId, game) {
  const { videoId, fullName, gameImage } = GAME_CONFIG[game];
  const codesPath = path.join(process.cwd(), CODES_FILE_PATH);
  const reader = getCodesReader(codesPath);

  // Step 1: Check if user has code for this game
  const userCodes = reader.findByUser(userId);
  const userCode = userCodes.find(entry => entry.game === game);

  // If NO code exists
  if (!userCode) {
    const reason = `Please run /generate ${game} first to get a code, then use /yt after you've commented on the YouTube video.`;
    return {
      success: false,
      gameFullName: fullName,
      isError: true,
      reason
    };
  }

  // If code already used
  if (userCode.used) {
    const reason = `You have already claimed the reward for this game`;
    return {
      success: false,
      gameFullName: fullName,
      isError: true,
      reason
    };
  }

  // If code expired
  if (isExpired(userCode.createdAt)) {
    const reason = `Your code for ${fullName} has expired. Please run /generate ${game} again to get a new code.`;
    return {
      success: false,
      gameFullName: fullName,
      isError: true,
      reason
    };
  }

  // Step 2: Code is valid - check YouTube comment store and consume if found
  let result = await checkAndConsumeValidatedCode(videoId, userCode.code, game, userCode.username);
  if (result.consumed) {
    return {
      success: true,
      gameFullName: fullName,
      isError: false,
      reward: result.reward
    };
  }

  // Step 3: Code not found in store - run processor to fetch and validate fresh comments
  // Note: processComments validates all new comments but does NOT consume any.
  // Consumption is done below, only for the invoking user's specific code.
  await processComments(game);

  // Step 4: Recheck the store now that new comments have been processed
  result = await checkAndConsumeValidatedCode(videoId, userCode.code, game, userCode.username);
  if (result.consumed) {
    return {
      success: true,
      gameFullName: fullName,
      isError: false,
      reward: result.reward
    };
  }

  // Step 5: Still not found or validation failed — show reason
  const updatedCodeData = findCodeInCommentStore(videoId, userCode.code);
  const validationReason = updatedCodeData?.validation?.reason
    ? getHumanReadableReason(updatedCodeData.validation.reason)
    : 'Your YouTube comment with code was not found or failed validation';

  const reason = `${validationReason}\n\nMake sure you commented on the video with format=> yourname:${userCode.code} E.g, Adarsh:XYP231`;
  return {
    success: false,
    gameFullName: fullName,
    isError: true,
    reason
  };
}

module.exports = {
  processYouTubeRewardCommand
};
