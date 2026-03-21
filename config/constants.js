/**
 * Centralized configuration for business rules and system behavior.
 * Changing values here affects the entire application.
 */

const CODE_EXPIRY_MS = 5 * 60 * 1000; // Validity window for a code
const CODE_LENGTH = 6; // Length of generated codes

// Relative path to the JSON storage file
const CODES_FILE_PATH = 'data/codes.json';

/**
 * Game Configuration
 *
 * Each game defines:
 * - enabled → whether users can claim
 * - associated YouTube video
 * - reward → what is given after successful validation
 */

const GAME_CONFIG = {
  "GTA-VC": {
    enabled: true,
    //videoId: "hkOkpwLUzjs",
    videoId: "m0vT-8SA4tM",
    reward: "MEGA_KEY_VC_123"
  }
};

module.exports = {
  CODE_EXPIRY_MS,
  CODE_LENGTH,
  CODES_FILE_PATH,
  GAME_CONFIG

};