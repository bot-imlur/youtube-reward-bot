/**
 * Validation Utilities
 *
 * Purpose:
 * - Central place for input validation logic
 * - Prevents duplication across controller, service, and future integrations
 */

const { GAME_CONFIG } = require('../config/constants');

/**
 * Normalizes game input to canonical format
 *
 * @param {string} game
 * @returns {string|null} Normalized game (e.g., GTA-VC) or null if invalid
 */
function normalizeGame(game) {
  if (!game) return null;

  const normalized = game.toUpperCase();

  return GAME_CONFIG[normalized] ? normalized : null;
}

/**
 * Checks whether a given game is supported and enabled.
 *
 * @param {string} game - Game name provided by user
 * @returns {boolean} True if game exists and is enabled, otherwise false
 */
function isSupportedGame(game) {
  const normalized = normalizeGame(game);
  return normalized && GAME_CONFIG[normalized]?.enabled === true;
}

/**
 * Returns a list of all enabled games.
 *
 * @returns {string[]} Array of enabled game names
 */
function getEnabledGames() {
  return Object.entries(GAME_CONFIG)
    .filter(([_, config]) => config.enabled)
    .map(([game]) => game);
}

/**
 * Retrieves the reward associated with a given game.
 *
 * @param {string} game - Game name
 * @returns {string|null} Reward string if game exists, otherwise null
 */
function getRewardForGame(game) {
  const normalized = game?.toUpperCase();
  return GAME_CONFIG[normalized]?.reward || null;
}

module.exports = {
  normalizeGame,
  isSupportedGame,
  getEnabledGames,
  getRewardForGame
};