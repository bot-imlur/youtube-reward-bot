/**
 * Claim Result Constants
 *
 * Purpose:
 * - Defines all possible validation outcomes for a claim
 * - Used across:
 *    - claimRewardService (business validation)
 *    - youtubeClaimProcessor (parsing + validation flow)
 *
 * Design:
 * - Represents ONLY validation results
 * - No system actions (like REWARD_READY)
 *
 * Rule:
 * - Every failure MUST map to one of these constants
 * - success === true implies reward eligibility
 */

const CLAIM_RESULT = {
  /**
   * Comment format is invalid
   * (Parser could not extract username/code)
   */
  PARSE_FAILED: "PARSE_FAILED",

  /**
   * Code does not exist in the system
   */
  INVALID_CODE: "INVALID_CODE",

  /**
   * Code already used (reward already granted)
   */
  ALREADY_USED: "ALREADY_USED",

  /**
   * Code expired before being used
   */
  EXPIRED: "EXPIRED",

  /**
   * Code belongs to a different game
   * than the one being processed
   */
  GAME_MISMATCH: "GAME_MISMATCH",

  /**
   * Unknown validation error
   */
  UNKNOWN: "UNKNOWN"
};

/**
 * Translates validation reason codes to user-friendly messages
 * @param {string} reasonCode - CLAIM_RESULT constant
 * @returns {string} Human-readable error message
 */
function getHumanReadableReason(reasonCode) {
  const reasonMap = {
    [CLAIM_RESULT.PARSE_FAILED]: 'Your comment format is invalid (use format: yourname:CODE). Please check and comment again.',
    [CLAIM_RESULT.INVALID_CODE]: 'Your code does not exist or is invalid. Please check and comment again.',
    [CLAIM_RESULT.ALREADY_USED]: 'Your code has already been used',
    [CLAIM_RESULT.EXPIRED]: 'Your code has expired. Request a new one with /claim command.',
    [CLAIM_RESULT.GAME_MISMATCH]: 'Your code is for a different game. Please check and comment on the correct video.',
    [CLAIM_RESULT.UNKNOWN]: 'Unknown validation error'
  };
  
  return reasonMap[reasonCode] || reasonCode;
}

module.exports = {
  CLAIM_RESULT,
  getHumanReadableReason
};