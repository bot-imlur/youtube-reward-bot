/**
 * Code Reader Utility
 *
 * Purpose:
 * - Provides a read-only, query-style interface over codes.json
 * - Abstracts raw JSON structure into usable objects
 * - Keeps querying logic separate from business logic
 *
 * Design Principles:
 * - Always reads fresh data from file (no caching)
 * - Returns normalized objects: { code, userId, game, used, createdAt }
 * - Does NOT perform any mutations (read-only layer)
 *
 * Why this exists:
 * - Avoids repetitive Object.entries(...) loops across services
 * - Makes code easier to read and reason about
 * - Prepares for future migration to DB (same interface, different backend)
 */

const { readJsonFile } = require('./fileUtils');

/**
 * Initializes a reader instance for the given file path.
 *
 * @param {string} filePath - Path to codes.json
 * @returns {object} Reader with query methods
 */
function getCodesReader(filePath) {
  // Always read latest state from file
  const codes = readJsonFile(filePath);

  /**
   * Returns all codes in normalized format.
   *
   * Output format:
   * [
   *   {
   *     code: "ABC123",
   *     userId: "...",
   *     game: "GTA-VC",
   *     used: false,
   *     createdAt: 1710000000
   *   }
   * ]
   */
  function getAll() {
    return Object.entries(codes).map(([code, data]) => ({
      code,
      ...data
    }));
  }

  /**
   * Finds a specific code by its identifier.
   *
   * @param {string} code - Code value (e.g. ABC123)
   * @returns {object|null} Matching entry or null if not found
   */
  function findByCode(code) {
    if (!codes[code]) return null;

    return {
      code,
      ...codes[code]
    };
  }

  /**
   * Returns all codes associated with a given user.
   *
   * Note:
   * - Does NOT filter by "used" or expiry
   * - Caller is responsible for applying business rules
   *
   * @param {string} userId - Discord user ID
   * @returns {Array<object>} List of codes for the user
   */
  function findByUser(userId) {
    return getAll().filter(entry => entry.userId === userId);
  }

  return {
    getAll,
    findByCode,
    findByUser
  };
}

module.exports = {
  getCodesReader
};