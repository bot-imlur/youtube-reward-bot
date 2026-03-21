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
const { isExpired } = require('../utils/expiryUtils');
const { validateCode, consumeCode } = require('./claimRewardService');
const { CODES_FILE_PATH, GAME_CONFIG } = require('../config/constants');
const { getHumanReadableReason } = require('../config/claimResult');

/**
 * Check YouTube comment store for successful validation and consume code if valid
 * Extracted to avoid code duplication
 *
 * @param {string} videoId
 * @param {string} code
 * @param {string} game
 * @returns {Promise<{found: boolean, consumed: boolean, reward?: string, reason?: string}>}
 */
async function checkAndConsumeValidatedCode(videoId, code, game) {
  console.log(`[checkAndConsumeValidatedCode] Checking code "${code}" for game "${game}"`);
  const codeData = findCodeInCommentStore(videoId, code);
  console.log(`[checkAndConsumeValidatedCode] codeData:`, codeData);

  if (!codeData) {
    return {
      found: false,
      consumed: false,
      reason: 'Comment with code not found in YouTube'
    };
  }

  // Comment found - check if validation succeeded
  if (codeData.validation && codeData.validation.success === true) {
    // Validation succeeded - consume the code
    console.log(`[checkAndConsumeValidatedCode] Validation successful, consuming code`);
    const consumeResult = await consumeCode(code);
    console.log(`[checkAndConsumeValidatedCode] consumeResult:`, consumeResult);
    
    if (consumeResult.success) {
      const reward = getRewardForGame(game);
      return {
        found: true,
        consumed: true,
        reward
      };
    }
  }

  // Comment found but validation failed - return the reason
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
    const reason = `Please run /claim ${game} first to get a code, then use /yt after you've commented on the YouTube video.`;
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
    const reason = `Your code for ${fullName} has expired. Please run /claim ${game} again to get a new code.`;
    return {
      success: false,
      gameFullName: fullName,
      isError: true,
      reason
    };
  }

  // Step 2: Code is valid - check YouTube comment store and consume if found
  let result = await checkAndConsumeValidatedCode(videoId, userCode.code, game);
  if (result.consumed) {
    return {
      success: true,
      gameFullName: fullName,
      isError: false,
      reward: result.reward
    };
  }

  // Step 3: Code not found in store - run processor to fetch fresh comments
  console.log(`[/yt] Running processor for ${game} to fetch fresh comments`);
  const processorResults = await processComments(game);
  
  // Step 4: Check if user's code was in the results
  const userResult = processorResults.find(r => r.userId === userId && r.code === userCode.code);
  
  if (userResult) {
    // Processor found and successfully validated the code (already consumed)
    return {
      success: true,
      gameFullName: fullName,
      isError: false,
      reward: userResult.reward
    };
  }

  // Step 5: Processor didn't find valid code - show reason
  const updatedCodeData = findCodeInCommentStore(videoId, userCode.code);
  const validationReason = updatedCodeData?.validation?.reason 
    ? getHumanReadableReason(updatedCodeData.validation.reason)
    : 'Your YouTube comment for this code was not found or failed validation';
  
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
