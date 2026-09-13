/**
 * Production Game Configuration
 *
 * Live game entries with real YouTube video IDs, reward keys, and channel restrictions.
 * This file is loaded when NODE_ENV === 'production'.
 *  * Each game defines:
 * - enabled → whether users can claim
 * - fullName → Human-readable game name for messages
 * - videoId → Associated YouTube video ID (used for comment fetching)
 * - videoName → Human-readable video title shown in DM instructions
 * - reward → R2 object key for the game file (used to generate a signed download URL)
 * - gameImage → Path to game image file (shown in reward messages)
 * - allowedChannelIds → List of channels where this game is available (must be subset of GLOBAL_ALLOWED_CHANNELS)
 *                       Empty array = available in all global channels
 */

const GAME_CONFIG = {
  "GTA-VC": {
    enabled: true,
    fullName: "Grand Theft Auto: Vice City - The NextGen Edition",
    videoId: "dNiGCcXsEps",
    videoName: "Simplest Installation Guide - Grand Theft Auto - Vice City NextGen Edition",
    reward: "gta-vc/reward.rar",
    gameImage: "static/images/gta-vc.png",
    allowedChannelIds: process.env.GTA_VC_ALLOWED_CHANNELS
      ? process.env.GTA_VC_ALLOWED_CHANNELS.split(',')
      : []
  },
  "GTA-SA": {
    enabled: true,
    fullName: "Grand Theft Auto: San Andreas - The NextGen Edition",
    videoId: "dUmMyViD000", // TODO: replace with real YouTube video ID before go-live
    videoName: "Simplest Installation Guide - Grand Theft Auto - San Andreas NextGen Edition",
    reward: "gta-sa/reward.rar",
    gameImage: "static/images/gta-sa.png",
    allowedChannelIds: process.env.GTA_SA_ALLOWED_CHANNELS
      ? process.env.GTA_SA_ALLOWED_CHANNELS.split(',')
      : []
  }
};

module.exports = GAME_CONFIG;
