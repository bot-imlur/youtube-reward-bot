/**
 * Code Service Module
 *
 * Responsibility:
 * - Handles all business logic related to code generation and lifecycle.
 * - Ensures each user has at most one active code per game.
 * - Enforces expiration rules.
 *
 * Design Notes:
 * - Uses JSON file as source of truth.
 * - Uses Code Reader for query-like operations.
 */

const path = require('path');
const { readJsonFile, writeJsonFile } = require('../utils/fileUtils');
const { getCodesReader } = require('../utils/codeReader');
const { isExpired } = require('../utils/expiryUtils');
const logger = require('../utils/logger');
const {
  CODE_EXPIRY_MS,
  CODE_LENGTH,
  CODES_FILE_PATH
} = require('../config/constants');
const { EVENTS } = require('../config/events');
const { STATUS } = require('../config/status');

const FILE_PATH = path.join(process.cwd(), CODES_FILE_PATH);

function generateCode() {
  return Math.random()
    .toString(36)
    .substring(2, 2 + CODE_LENGTH)
    .toUpperCase();
}

/**
 * Generates or retrieves a code for a user based on lifecycle rules.
 *
 * Flow:
 * 1. If user already has a code:
 *    - If used → do NOT generate new (terminal state)
 *    - If not expired → return existing
 *    - If expired → delete and generate new
 *
 * 2. If no code exists → generate new
 *
 * Returns:
 * {
 *   code: string,
 *   status: STATUS.*
 * }
 */
function createCode(userId, username, game){
  const codes = readJsonFile(FILE_PATH);
  const reader = getCodesReader(FILE_PATH);

  // Find any existing code for this user + game
  const existing = reader.findByUser(userId)
    .find(entry => entry.game === game);

  if (existing) {
    // Terminal state: code already used → block new generation
    if (existing.used) {
      logger.warn(EVENTS.CODE_USED_NO_GENERATION, {
        userId,
        username,
        code: existing.code,
        game
      });

      return {
        code: existing.code,
        status: STATUS.ALREADY_USED
      };
    }

    // Code still valid → return existing
    if (!isExpired(existing.createdAt)) {
      logger.info(EVENTS.CODE_EXISTING, {
        userId,
        username,
        code: existing.code,
        game
      });

      return {
        code: existing.code,
        status: STATUS.EXISTING
      };
    }

    // Code expired (but not used) → remove and generate new
    logger.info(EVENTS.CODE_EXPIRED, {
      userId,
      username,
      code: existing.code,
      game
    });

    if (codes[existing.code]) {
        delete codes[existing.code];
    }
  }

  // Generate a unique new code (avoid collisions)
  let newCode;
  do {
    newCode = generateCode();
  } while (codes[newCode]);

  // Persist new code
  codes[newCode] = {
    userId,
    username,
    game,
    used: false,
    createdAt: Date.now()
  };

  writeJsonFile(FILE_PATH, codes);

  logger.info(EVENTS.CODE_CREATED, {
    userId,
    username,
    code: newCode,
    game
  });

  return {
    code: newCode,
    status: STATUS.NEW
  };
}

module.exports = {
  createCode
};