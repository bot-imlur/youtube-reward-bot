/**
 * Development Game Configuration
 *
 * Mirrors the production structure with test values.
 * Uses separate video IDs, reward keys, and channels so dev testing
 * never touches production YouTube videos or R2 objects.
 *
 * This file is loaded when NODE_ENV !== 'production'.
 */

const GAME_CONFIG = {
  "GTA-VC": {
    enabled: true,
    fullName: "Grand Theft Auto: Vice City - The NextGen Edition",
    videoId: "dNiGCcXsEps",                // TODO: Replace with a test/unlisted video ID
    videoName: "Simplest Installation Guide - Grand Theft Auto - Vice City NextGen Edition",
    reward: "gta-vc/reward.rar",            // TODO: Replace with a test R2 object key
    gameImage: "static/images/gta-vc.png",
    allowedChannelIds: process.env.GTA_VC_ALLOWED_CHANNELS
      ? process.env.GTA_VC_ALLOWED_CHANNELS.split(',')
      : []
  }
};

module.exports = GAME_CONFIG;
