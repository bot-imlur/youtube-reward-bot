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
const { isExpired } = require('../utils/expiryUtils');
const { withLock } = require('../utils/dataLock');
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
 * Thread-Safety:
 * - Entire read-modify-write sequence is protected by file lock.
 * - Ensures no concurrent write conflicts or lost updates.
 *
 * Returns:
 * {
 *   code: string,
 *   status: STATUS.*
 * }
 */
async function createCode(userId, username, game) {
  return withLock(FILE_PATH, async () => {
    const codes = readJsonFile(FILE_PATH);

    // Find any existing code for this user + game
    // (search directly instead of using reader to avoid double file reads)
    const existing = Object.entries(codes).find(
      ([_, data]) => data.userId === userId && data.game === game
    );

    if (existing) {
      const [existingCode, existingData] = existing;
      
      // Terminal state: code already used → block new generation
      if (existingData.used) {
        logger.warn(EVENTS.CODE_USED_NO_GENERATION, {
          userId,
          username,
          code: existingCode,
          game
        });

        return {
          code: existingCode,
          status: STATUS.ALREADY_USED
        };
      }

      // Code still valid → return existing
      if (!isExpired(existingData.createdAt)) {
        logger.info(EVENTS.CODE_EXISTING, {
          userId,
          username,
          code: existingCode,
          game
        });

        const expiresAt = existingData.createdAt + CODE_EXPIRY_MS;
        return {
          code: existingCode,
          status: STATUS.EXISTING,
          expiresAt
        };
      }

      // Code expired (but not used) → remove and generate new
      logger.info(EVENTS.CODE_EXPIRED, {
        userId,
        username,
        code: existingCode,
        game
      });

      if (codes[existingCode]) {
          delete codes[existingCode];
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

    const expiresAt = Date.now() + CODE_EXPIRY_MS;
    return {
      code: newCode,
      status: STATUS.NEW,
      expiresAt
    };
  });
}

module.exports = {
  createCode
};