/**
 * Centralized configuration for business rules and system behavior.
 * Changing values here affects the entire application.
 */

const CODE_EXPIRY_MS = 5 * 60 * 1000; // Validity window for a code
const CODE_LENGTH = 6; // Length of generated codes

// Relative path to the JSON storage file
// Can be overridden via CODES_FILE_PATH environment variable for testing
const CODES_FILE_PATH = process.env.CODES_FILE_PATH || 'data/codes.json';

// Admin User ID restricted to command overwrites
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || null; // TODO: Provide your Discord user ID in .env

// Public YouTube channel URL — shared across all games, used in claim code DMs
const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@BotImlur';

// Global Channel Restriction
// Bot commands only work in these channels (empty = all channels allowed)
// Game-specific channels must be a subset of these
const GLOBAL_ALLOWED_CHANNELS = process.env.GLOBAL_ALLOWED_CHANNELS
  ? process.env.GLOBAL_ALLOWED_CHANNELS.split(',')
  : []; // Default empty array instead of a hardcoded ID

/**
 * Game Configuration
 *
 * Each game defines:
 * - enabled → whether users can claim
 * - fullName → Human-readable game name for messages
 * - videoId → Associated YouTube video ID (used for comment fetching)
 * - videoName → Human-readable video title shown in DM instructions
 * - reward → Reward key given after successful validation
 * - gameImage → Path to game image file (shown in reward messages)
 * - allowedChannelIds → List of channels where this game is available (must be subset of GLOBAL_ALLOWED_CHANNELS)
 *                       Empty array = available in all global channels
 */

const GAME_CONFIG = {
  "GTA-VC": {
    enabled: true,
    fullName: "Grand Theft Auto: Vice City",
    videoId: "m0vT-8SA4tM",
    videoName: "GTA Vice City Definitive Edition",
    reward: "MEGA_KEY_VC_123",
    gameImage: "static/images/gta-vc.webp",
    allowedChannelIds: process.env.GTA_VC_ALLOWED_CHANNELS
      ? process.env.GTA_VC_ALLOWED_CHANNELS.split(',')
      : [] // Must be subset of GLOBAL_ALLOWED_CHANNELS
  }
};

module.exports = {
  ADMIN_USER_ID,
  CODE_EXPIRY_MS,
  CODE_LENGTH,
  CODES_FILE_PATH,
  GLOBAL_ALLOWED_CHANNELS,
  YOUTUBE_CHANNEL_URL,
  GAME_CONFIG
};