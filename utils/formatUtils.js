/**
 * Format Utility
 * 
 * Purpose:
 * - Provides generic formatting functions for tabular data.
 * - Centralizes text-pad alignment logic for Discord markdown blocks.
 */

const { GAME_CONFIG } = require('../config/constants');

/**
 * Formats a categorized dictionary of codes into a Discord-ready tabular text report.
 * 
 * @param {object} groupedCodes - Object containing codes grouped by game keys
 * @returns {string} Fully padded and formatted tabular text
 */
function formatCodesReport(groupedCodes) {
  let outputText = '';

  for (const [gameCode, gameCodes] of Object.entries(groupedCodes)) {
    const fullName = GAME_CONFIG[gameCode] ? GAME_CONFIG[gameCode].fullName : gameCode;
    outputText += `\n\n=== GAME: ${fullName} ===\n\n`;
    outputText += `UserId               Username        Code     Used  Created\n`;
    outputText += `---------------------------------------------------------------------------\n`;

    // Sort by created date descending (newest first)
    gameCodes.sort((a, b) => b.createdAt - a.createdAt);

    for (const record of gameCodes) {
      const dateObj = new Date(record.createdAt);
      // Fallback format if date is invalid, else local short date-time
      const dateStr = dateObj.getTime()
        ? dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
        : 'Unknown';

      const usedStr = record.used ? 'YES ' : 'NO  ';
      const userPad = record.userId.padEnd(20, ' ');
      const namePad = (record.username || '-').substring(0, 14).padEnd(15, ' ');
      const codePad = record.code.padEnd(8, ' ');

      outputText += `${userPad} ${namePad} ${codePad} ${usedStr} ${dateStr}\n`;
    }
    outputText += `\n`;
  }

  return outputText;
}

/**
 * Formats the live game configuration metadata into a readable Discord text block.
 * 
 * @param {string|null} filterGame - Optional game code to filter by
 * @returns {string} Formatted metadata text block
 */
function formatGameConfigReport(filterGame) {
  let outputText = '';

  for (const [gameCode, meta] of Object.entries(GAME_CONFIG)) {
    if (filterGame && gameCode !== filterGame) continue;

    outputText += `=== CODE: ${gameCode} ===\n`;
    outputText += `Full Name:    ${meta.fullName || 'N/A'}\n`;
    
    // Explicitly check for false, as undefined/missing implies true by default
    const status = meta.enabled !== false ? 'Enabled' : 'Disabled';
    outputText += `Status:       ${status}\n`;
    
    outputText += `Video Name:   ${meta.videoName || 'N/A'}\n`;
    outputText += `Video ID:     ${meta.videoId || 'N/A'} (https://youtu.be/${meta.videoId})\n`;
    outputText += `Reward Key:   ${meta.reward || 'N/A'}\n`;

    const channels = Array.isArray(meta.allowedChannelIds) && meta.allowedChannelIds.length > 0
      ? meta.allowedChannelIds.join(', ')
      : 'Server Global';

    outputText += `Channels:     ${channels}\n`;

    if (meta.gameImage) {
      outputText += `Thumbnail:    ${meta.gameImage}\n`;
    }
    outputText += `\n`;
  }

  return outputText;
}

module.exports = {
  formatCodesReport,
  formatGameConfigReport
};
