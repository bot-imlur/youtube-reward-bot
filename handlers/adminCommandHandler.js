/**
 * Admin Command Handler
 *
 * Responsibility:
 * - Routes and processes all admin slash commands (prefixed with "admin-").
 * - Enforces ADMIN_USER_ID check before any admin action.
 * - Handles /admin-overwrite: generates a fresh code for target user, immediately
 *   consumes it, and delivers the reward directly to the target user via DM.
 *
 * Design Notes:
 * - Reuses existing codeService, claimRewardService, and discordService methods.
 * - Channel restrictions are intentionally skipped for admin commands — the admin
 *   may invoke this from any channel.
 */

const { MessageFlags } = require('discord.js');
const { ADMIN_USER_ID, GAME_CONFIG } = require('../config/constants');
const { COMMANDS } = require('../config/commands');
const { normalizeGame } = require('../utils/validationUtils');
const { createAdminOverwriteCode } = require('../services/codeService');
const { consumeCode } = require('../services/claimRewardService');
const { sendRewardMessage } = require('../services/discordService');
const { EVENTS } = require('../config/events');
const logger = require('../utils/logger');

/**
 * Verifies that the invoking user is the configured admin.
 *
 * @param {string} invokerId - Discord user ID of the command invoker
 * @returns {boolean} true if the invoker is the admin, false otherwise
 */
function isAdmin(invokerId) {
  return ADMIN_USER_ID && invokerId === ADMIN_USER_ID;
}

/**
 * Handles the /admin-overwrite command.
 *
 * Flow:
 * 1. Resolve target user from Discord (fails fast if user ID is invalid).
 * 2. Validate game parameter.
 * 3. Create a fresh admin-overwrite code for the target user + game.
 * 4. Immediately consume the code (marks as used).
 * 5. Send the reward to the target user via DM.
 * 6. Reply to admin with success or failure.
 *
 * @param {Client} client      - Discord client instance
 * @param {Interaction} interaction - Discord slash command interaction
 */
async function handleAdminOverwrite(client, interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUserId = interaction.options.getString(COMMANDS.ADMIN_OVERWRITE.options.USER_ID.name);
  const gameInput = interaction.options.getString(COMMANDS.ADMIN_OVERWRITE.options.GAME.name);

  // Validate game
  const game = normalizeGame(gameInput);
  if (!game) {
    await interaction.editReply(`**Error:** Unknown or unsupported game: \`${gameInput}\``);
    return;
  }

  const { fullName, gameImage } = GAME_CONFIG[game];

  // Resolve target user from Discord to confirm the ID is valid and get username
  let targetUser;
  try {
    targetUser = await client.users.fetch(targetUserId);
  } catch {
    await interaction.editReply(`**Error:** Could not resolve Discord user with ID \`${targetUserId}\`. Ensure the ID is correct.`);
    return;
  }

  // Create a fresh admin-overwrite code, removing any prior code for this user + game
  const { code } = await createAdminOverwriteCode(targetUserId, targetUser.username, game);

  // Consume the code immediately — admin bypass skips the YouTube verification step
  const consumeResult = await consumeCode(code);
  if (!consumeResult.success) {
    await interaction.editReply(`**Error:** Failed to consume code \`${code}\` for user \`${targetUser.username}\`. Please try again.`);
    return;
  }

  // Send reward DM to the target user
  const reward = GAME_CONFIG[game].reward;
  const dmSent = await sendRewardMessage(client, targetUserId, fullName, reward, gameImage);

  if (!dmSent) {
    await interaction.editReply(
      `**Warning:** Code consumed for **${targetUser.username}** (${targetUserId}), but DM could not be delivered.\n` +
      `Reward: \`${reward}\` — deliver manually if needed.`
    );
    return;
  }

  logger.info(EVENTS.ADMIN_CODE_OVERWRITE, {
    adminUserId: interaction.user.id,
    targetUserId,
    targetUsername: targetUser.username,
    code,
    game,
    dmDelivered: dmSent
  });

  await interaction.editReply(
    `Reward delivered to **${targetUser.username}** (${targetUserId}) for **${fullName}**.`
  );
}

/**
 * Entry point for all admin commands.
 * Enforces ADMIN_USER_ID gate, then dispatches to the appropriate handler.
 *
 * @param {Client} client      - Discord client instance
 * @param {Interaction} interaction - Discord slash command interaction
 */
async function handleAdminCommand(client, interaction) {
  // Guard: only the configured admin may run these commands
  if (!isAdmin(interaction.user.id)) {
    await interaction.reply({
      content: '**Access Denied.** This command is restricted to authorized administrators only. Unauthorized usage has been noted.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.commandName === COMMANDS.ADMIN_OVERWRITE.name) {
    await handleAdminOverwrite(client, interaction);
    return;
  }

  // Fallback for any unrecognised admin commands
  await interaction.reply({
    content: `Unknown admin command: /${interaction.commandName}`,
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  handleAdminCommand
};
