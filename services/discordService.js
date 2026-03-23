/**
 * Discord Service
 *
 * Purpose:
 * - Handles all Discord-specific operations
 * - Formats and sends direct messages (DMs)
 *
 * Design:
 * - Isolated from business logic
 * - Reusable across system
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');

/**
 * Format an error message for ephemeral channel reply
 *
 * @param {string} gameFullName - Full game name
 * @param {string} reason - Error reason/message
 *
 * @returns {string} Formatted error message
 */
function formatErrorReply(gameFullName, reason) {
  return `❌ **${gameFullName}**\n\n${reason}\n\nContact support if you believe this is an error.`;
}

/**
 * Sends a formatted claim code message via DM
 *
 * @param {Client} client - Discord client instance
 * @param {string} userId - Discord user ID
 * @param {string} gameCode - The normalized game code (e.g., "GTA-VC")
 * @param {string} gameFullName - Full game name
 * @param {string} code - The claim code
 * @param {number} expiresAt - Timestamp when code expires
 * @param {string} channelUrl - Public YouTube channel URL (drives discovery)
 * @param {string} videoName - Human-readable video title users should look for
 *
 * @returns {Promise<boolean>} true if success, false otherwise
 */
async function sendClaimCodeMessage(client, userId, gameCode, gameFullName, code, expiresAt, channelUrl, videoName) {
  try {
    const user = await client.users.fetch(userId);
    const expiryTime = new Date(expiresAt).toLocaleTimeString();

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Claim Code Generated')
      .setDescription(`Your code for **${gameFullName}** has been generated.`)
      .addFields(
        { name: 'Your Code', value: `\`\`\`${code}\`\`\``, inline: false },
        { name: 'Expires At', value: expiryTime, inline: true },
        {
          name: 'Next Steps',
          // Link to the channel so users discover content; video title tells them exactly what to find
          value: `1. Go to the [My Youtube Channel](${channelUrl}) and find the video **"${videoName}"**\n2. Comment: \`yourname:${code}\`\n3. Run \`/claim ${gameCode}\` to claim your reward`,
          inline: false
        }
      )
      .setFooter({ text: 'Keep this code safe and comment on YouTube before it expires!' });

    await user.send({ embeds: [embed] });
    return true;
  } catch (err) {
    console.error("[DiscordService] Claim code message failed:", err.message);
    return false;
  }
}

/**
 * Sends a formatted reward message with a signed download link
 *
 * @param {Client} client - Discord client instance
 * @param {string} userId - Discord user ID
 * @param {string} gameFullName - Full game name (e.g., "Grand Theft Auto: Vice City")
 * @param {string} reward - Reward value for the user
 * @param {string} gameImagePath - Optional path to game image file
 *
 * @returns {Promise<boolean>} true if success, false otherwise
 */
async function sendRewardMessage(client, userId, gameFullName, reward, gameImagePath = null) {
  try {
    const user = await client.users.fetch(userId);

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎮 Reward Unlocked!')
      .setDescription(`Congratulations! You've successfully validated your claim`)
      .addFields(
        { name: 'Game', value: gameFullName, inline: true },
        {
          name: '📥 Download Your Game',
          value: `[Click here to download](${reward})\n⏳ This link expires in **30 minutes**.`,
          inline: false
        }
      )
      .setFooter({ text: '⚠️ This link is unique to you — do not share it.' });

    const sendOptions = { embeds: [embed] };

    // Attach image if provided
    if (gameImagePath) {
      const imagePath = path.join(process.cwd(), gameImagePath);
      const fileName = path.basename(imagePath);
      const attachment = new AttachmentBuilder(imagePath, { name: fileName });
      embed.setImage(`attachment://${fileName}`);
      sendOptions.files = [attachment];
    }

    await user.send(sendOptions);
    return true;
  } catch (err) {
    console.error("[DiscordService] Reward message failed:", err.message);
    return false;
  }
}

module.exports = {
  sendRewardMessage,
  sendClaimCodeMessage,
  formatErrorReply
};