/**
 * Claim Reward Service
 *
 * Purpose:
 * - Validates a code against the system
 * - Ensures it belongs to the expected game
 * - Consumes (marks used) ONLY after all checks pass
 *
 * Design:
 * - Validation + consumption combined (but safely ordered)
 * - No mutation happens before all validations succeed
 */

const path = require('path');
const { readJsonFile, writeJsonFile } = require('../utils/fileUtils');

const CODES_PATH = path.join(process.cwd(), 'data/codes.json');
const { isExpired } = require('../utils/expiryUtils');
const { CLAIM_RESULT } = require('../config/claimResult');

/**
 * Validates and consumes a code for a specific game
 *
 * @param {string} code - Unique claim code
 * @param {string} expectedGame - Game context from processor
 *
 * @returns {object}
 * {
 *   success: boolean,
 *   reason?: CLAIM_RESULT,
 *   userId?: string,
 *   game?: string
 * }
 */
function validateAndConsumeCode(code, expectedGame) {
  const codes = readJsonFile(CODES_PATH);

  const entry = codes[code];

  /**
   * Code does not exist
   */
  if (!entry) {
    return {
      success: false,
      reason: CLAIM_RESULT.INVALID_CODE
    };
  }

  /**
   * Code already used
   */
  if (entry.used) {
    return {
      success: false,
      reason: CLAIM_RESULT.ALREADY_USED
    };
  }

  /**
   * Code expired
   */
  if (isExpired(entry.createdAt)) {
    return {
      success: false,
      reason: CLAIM_RESULT.EXPIRED
    };
  }

  /**
   * Code belongs to a different game
   * than the one being processed
   */
  if (entry.game !== expectedGame) {
    return {
      success: false,
      reason: CLAIM_RESULT.GAME_MISMATCH,
      actualGame: entry.game
    };
  }

  /**
   * All validations passed → now consume the code
   */
  entry.used = true;
  writeJsonFile(CODES_PATH, codes);

  /**
   * Successful claim
   */
  return {
    success: true,
    userId: entry.userId,
    game: entry.game
  };
}

module.exports = {
  validateAndConsumeCode
};