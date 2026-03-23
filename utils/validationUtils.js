/**
 * Validation Utilities
 *
 * Purpose:
 * - Central place for input validation logic
 * - Prevents duplication across controller, service, and future integrations
 */

const { GAME_CONFIG, GLOBAL_ALLOWED_CHANNELS } = require('../config/constants');

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
 * Checks whether a given game is supported, enabled, and available in the current channel.
 *
 * @param {string} game - Game name provided by user
 * @param {string} channelId - Discord channel ID
 * @returns {boolean} True if game exists, is enabled, and available in this channel, otherwise false
 */
function isSupportedGame(game, channelId = null) {
  const normalized = normalizeGame(game);
  if (!normalized) return false;
  
  const gameConfig = GAME_CONFIG[normalized];
  if (!gameConfig?.enabled) return false;

  // If channelId provided, check if game is available in that channel
  if (channelId) {
    if (gameConfig.allowedChannelIds && gameConfig.allowedChannelIds.length > 0) {
      return gameConfig.allowedChannelIds.includes(channelId);
    }
  }

  return true;
}

/**
 * Retrieves the reward value associated with a given game.
 *
 * @param {string} game - Game name
 * @returns {string|null} Reward value if game exists, otherwise null
 */
function getRewardForGame(game) {
  const normalized = game?.toUpperCase();
  return GAME_CONFIG[normalized]?.reward || null;
}

/**
 * Check if a command is allowed in the given channel (global check)
 *
 * @param {string} channelId - Discord channel ID
 * @returns {boolean} true if channel is in global allowed list, false otherwise
 */
function isGlobalChannelAllowed(channelId) {
  if (!GLOBAL_ALLOWED_CHANNELS || GLOBAL_ALLOWED_CHANNELS.length === 0) {
    return true; // All channels allowed if not configured
  }
  return GLOBAL_ALLOWED_CHANNELS.includes(channelId);
}

module.exports = {
  normalizeGame,
  isSupportedGame,
  getRewardForGame,
  isGlobalChannelAllowed
};