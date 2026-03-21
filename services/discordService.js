/**
 * Discord Service
 *
 * Purpose:
 * - Handles all Discord-specific operations
 * - Currently supports sending direct messages (DM)
 *
 * Design:
 * - Isolated from business logic
 * - Reusable across system
 */

/**
 * Sends a direct message (DM) to a user
 *
 * @param {Client} client - Discord client instance
 * @param {string} userId - Discord user ID
 * @param {string} message - Message to send
 *
 * @returns {Promise<boolean>} true if success, false otherwise
 */
async function sendDM(client, userId, message) {
  try {
    const user = await client.users.fetch(userId);

    await user.send(message);

    return true;
  } catch (err) {
    console.error("[DiscordService] DM failed:", err.message);
    return false;
  }
}

module.exports = {
  sendDM
};