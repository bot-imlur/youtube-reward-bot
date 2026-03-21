const path = require('path');
const { readJsonFile, writeJsonFile } = require('../utils/fileUtils');
const { withLock } = require('../utils/dataLock');
const { CODES_FILE_PATH } = require('../config/constants');
const { isExpired } = require('../utils/expiryUtils');
const { CLAIM_RESULT } = require('../config/claimResult');
const { EVENTS } = require('../config/events');
const logger = require('../utils/logger');

const CODES_PATH = path.join(process.cwd(), CODES_FILE_PATH);

/**
 * Validates a code without consuming it
 *
 * Thread-Safety:
 * - File read is protected by lock to ensure consistent view of codes
 *
 * @param {string} code - Unique claim code
 * @param {string} expectedGame - Game context
 *
 * @returns {object}
 * {
 *   success: boolean,
 *   reason?: CLAIM_RESULT,
 *   userId?: string,
 *   game?: string
 * }
 */
async function validateCode(code, expectedGame) {
  return withLock(CODES_PATH, async () => {
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
     * All validations passed
     */
    return {
      success: true,
      userId: entry.userId,
      game: entry.game
    };
  });
}

/**
 * Consumes a code (marks as used)
 * Should only be called after validation succeeds
 *
 * @param {string} code - Unique claim code
 * @returns {object} { success: boolean }
 */
async function consumeCode(code) {
  return withLock(CODES_PATH, async () => {
    const codes = readJsonFile(CODES_PATH);
    const entry = codes[code];

    if (!entry) {
      return { success: false };
    }

    entry.used = true;
    writeJsonFile(CODES_PATH, codes);

    logger.info(EVENTS.CODE_CONSUMED, {
      code,
      userId: entry.userId,
      username: entry.username,
      game: entry.game
    });

    return { success: true };
  });
}

module.exports = {
  validateCode,
  consumeCode
};