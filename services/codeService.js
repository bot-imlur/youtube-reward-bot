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
 * Generates a unique code that does not collide with any existing keys in the codes store.
 *
 * @param {object} codes - Current in-memory codes store keyed by code string
 * @returns {string} A new unique code
 */
function generateUniqueCode(codes) {
  let code;
  do {
    code = generateCode();
  } while (codes[code]);
  return code;
}

/**
 * Persists a newly generated code to the in-memory codes store and flushes to disk.
 * Shared by both standard and admin-overwrite code creation paths.
 *
 * @param {object}  codes          - Current in-memory codes store (mutated in place)
 * @param {string}  newCode        - The generated unique code string
 * @param {string}  userId         - Discord user ID the code belongs to
 * @param {string}  username       - Discord username (for record-keeping)
 * @param {string}  game           - Normalized game key (e.g. "GTA-VC")
 * @param {boolean} adminOverwrite - Whether this code was issued via /admin-overwrite
 * @returns {number} createdAt     - The exact timestamp used, so callers can derive expiresAt consistently
 */
function persistNewCode(codes, newCode, userId, username, game, adminOverwrite) {
  const createdAt = Date.now(); // Captured once to ensure expiresAt is consistent with stored value

  codes[newCode] = {
    userId,
    username,
    game,
    used: false,
    adminOverwrite, // true if issued by admin, false for standard user flow
    createdAt
  };

  writeJsonFile(FILE_PATH, codes);

  logger.info(EVENTS.CODE_CREATED, {
    userId,
    username,
    code: newCode,
    game,
    adminOverwrite
  });

  return createdAt;
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

      // Code expired (but not used) → unconditionally remove and generate new
      logger.info(EVENTS.CODE_EXPIRED, {
        userId,
        username,
        code: existingCode,
        game
      });

      delete codes[existingCode]; // Safe: existingCode is confirmed present by find() above
    }

    // Generate a unique new code (avoid collisions with existing codes)
    const newCode = generateUniqueCode(codes);
    const createdAt = persistNewCode(codes, newCode, userId, username, game, false);

    // Derive expiresAt from the same createdAt used in storage to avoid any drift
    const expiresAt = createdAt + CODE_EXPIRY_MS;
    return {
      code: newCode,
      status: STATUS.NEW,
      expiresAt
    };
  });
}

/**
 * Admin Overwrite Code Creation
 *
 * Creates a fresh code for a target user and game, bypassing normal lifecycle rules.
 * Any existing code (used or unused, expired or not) for the same user + game is
 * deleted before issuing the new one. The new code is marked adminOverwrite: true
 * to distinguish it from standard user-generated codes.
 *
 * Thread-Safety:
 * - Entire read-modify-write sequence is protected by file lock.
 *
 * @param {string} userId    - Target Discord user ID
 * @param {string} username  - Target Discord username (for record-keeping)
 * @param {string} game      - Normalized game key (e.g. "GTA-VC")
 *
 * @returns {Promise<{ code: string, status: STATUS.NEW }>}
 */
async function createAdminOverwriteCode(userId, username, game) {
  return withLock(FILE_PATH, async () => {
    const codes = readJsonFile(FILE_PATH);

    // Remove any existing code for this user + game regardless of its state
    const existing = Object.entries(codes).find(
      ([_, data]) => data.userId === userId && data.game === game
    );

    if (existing) {
      const [existingCode] = existing;
      logger.info(EVENTS.CODE_EXPIRED, {
        userId,
        username,
        code: existingCode,
        game,
        reason: 'admin-overwrite: existing code removed'
      });
      delete codes[existingCode];
    }

    // Generate a unique code (avoid collisions with existing codes)
    const newCode = generateUniqueCode(codes);

    const createdAt = persistNewCode(codes, newCode, userId, username, game, true);
    const expiresAt = createdAt + CODE_EXPIRY_MS;

    return {
      code: newCode,
      status: STATUS.NEW,
      expiresAt
    };
  });
}

module.exports = {
  createCode,
  createAdminOverwriteCode
};