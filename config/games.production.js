/**
 * Production Game Configuration
 *
 * Live game entries with real YouTube video IDs, reward keys, and channel restrictions.
 * This file is loaded when NODE_ENV === 'production'.
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
  }
};

module.exports = GAME_CONFIG;
