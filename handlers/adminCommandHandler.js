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

const { MessageFlags, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { getCodesReader } = require('../utils/codeReader');
const { formatCodesReport, formatGameConfigReport } = require('../utils/formatUtils');
const { ADMIN_USER_ID, GAME_CONFIG, YOUTUBE_CHANNEL_URL, CODES_FILE_PATH } = require('../config/constants');
const { COMMANDS } = require('../config/commands');
const { normalizeGame } = require('../utils/validationUtils');
const { createAdminOverwriteCode } = require('../services/codeService');
const { consumeCode } = require('../services/claimRewardService');
const { sendRewardMessage, sendClaimCodeMessage } = require('../services/discordService');
const { generateDownloadUrl } = require('../services/r2Service');
const { EVENTS } = require('../config/events');
const logger = require('../utils/logger');

/**
 * Resolves and validates the game parameter from an interaction.
 * Automatically handles the error reply if the game is invalid.
 * 
 * @param {Interaction} interaction 
 * @param {object} commandObj - The command configuration block
 * @param {boolean} isOptional - Whether an empty string is allowed
 * @returns {Promise<{ game: string|null, error: boolean }>}
 */
async function resolveGameParam(interaction, commandObj, isOptional = false) {
  const gameInput = interaction.options.getString(commandObj.options.GAME.name);
  
  if (!gameInput) {
    if (isOptional) return { game: null, error: false };
    await interaction.editReply('**Error:** Game parameter is required.');
    return { game: null, error: true };
  }

  const game = normalizeGame(gameInput);
  if (!game) {
    await interaction.editReply(`**Error:** Unknown or unsupported game: \`${gameInput}\``);
    return { game: null, error: true };
  }

  return { game, error: false };
}

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
 * 1. Resolve target user from Discord.
 * 2. Validate game parameter.
 * 3. Create a fresh code for the target user (invalidating old ones).
 * 4. Send the new claim code to the target user via DM.
 * 5. Reply to admin with success.
 *
 * @param {Client} client      - Discord client instance
 * @param {Interaction} interaction - Discord slash command interaction
 */
async function handleAdminOverwrite(client, interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUserId = interaction.options.getString(COMMANDS.ADMIN_OVERWRITE.options.USER_ID.name);

  const { game, error } = await resolveGameParam(interaction, COMMANDS.ADMIN_OVERWRITE);
  if (error) return;

  const { fullName, videoName } = GAME_CONFIG[game];

  let targetUser;
  try {
    targetUser = await client.users.fetch(targetUserId);
  } catch {
    await interaction.editReply(`**Error:** Could not resolve Discord user with ID \`${targetUserId}\`. Ensure the ID is correct.`);
    return;
  }

  const { code, expiresAt } = await createAdminOverwriteCode(targetUserId, targetUser.username, game);

  const dmSent = await sendClaimCodeMessage(
    client,
    targetUserId,
    game,
    fullName,
    code,
    expiresAt,
    YOUTUBE_CHANNEL_URL,
    videoName
  );

  if (!dmSent) {
    await interaction.editReply(`**Warning:** Code force-generated for **${targetUser.username}**, but DM could not be delivered.`);
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

  await interaction.editReply(`✅ Fresh claim code (\`${code}\`) delivered to **${targetUser.username}** (${targetUserId}) for **${fullName}**.`);
}

/**
 * Handles the /admin-reward command.
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
async function handleAdminReward(client, interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUserId = interaction.options.getString(COMMANDS.ADMIN_REWARD.options.USER_ID.name);

  // Validate game
  const { game, error } = await resolveGameParam(interaction, COMMANDS.ADMIN_REWARD);
  if (error) return;

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

  // Generate a time-limited signed download URL for the target user
  const rewardKey = GAME_CONFIG[game].reward;
  const signedUrl = generateDownloadUrl(rewardKey, targetUserId, targetUser.username);

  const dmSent = await sendRewardMessage(client, targetUserId, fullName, signedUrl, gameImage);

  if (!dmSent) {
    await interaction.editReply(
      `**Warning:** Code consumed for **${targetUser.username}** (${targetUserId}), but DM could not be delivered. Please deliver the reward manually.`
    );
    return;
  }

  logger.info(EVENTS.ADMIN_REWARD_DELIVERED, {
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
 * Handles the /admin-get-codes command.
 * Fetches all active and historical claim codes, and formats them into
 * a native Discord codeblock or text file attachment.
 */
async function handleAdminGetCodes(client, interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { game: filterGame, error } = await resolveGameParam(interaction, COMMANDS.ADMIN_GET_CODES, true);
  if (error) return;

  const filePath = path.join(process.cwd(), CODES_FILE_PATH);
  const reader = getCodesReader(filePath);
  let allCodes = reader.getAll();

  if (filterGame) {
    allCodes = allCodes.filter(c => c.game === filterGame);
  }

  const groupedCodes = reader.groupByGame(allCodes);

  if (Object.keys(groupedCodes).length === 0) {
    await interaction.editReply(`No codes found${filterGame ? ` for game \`${filterGame}\`` : ''}.`);
    return;
  }

  const outputText = formatCodesReport(groupedCodes);

  // Gracefully handle Discord's 2000 character limit
  if (outputText.length < 1950) {
    await interaction.editReply(`\`\`\`text\n${outputText}\`\`\``);
  } else {
    // Attach as a text file if too large
    const buffer = Buffer.from(outputText, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: 'codes-report.txt' });
    await interaction.editReply({ 
      content: `Report is too large for Discord chat. See attached file:`, 
      files: [attachment] 
    });
  }
}

/**
 * Handles the /admin-get-games command.
 * Fetches and formats the game configuration metadata payload.
 */
async function handleAdminGetGames(client, interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { game: filterGame, error } = await resolveGameParam(interaction, COMMANDS.ADMIN_GET_GAMES, true);
  if (error) return;

  const outputText = formatGameConfigReport(filterGame);

  if (outputText.length === 0) {
    await interaction.editReply(`No games configured.`);
    return;
  }

  if (outputText.length < 1950) {
    await interaction.editReply(`\`\`\`text\n${outputText}\`\`\``);
  } else {
    const buffer = Buffer.from(outputText, 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: 'games-metadata.txt' });
    await interaction.editReply({ 
      content: `Games config report is too large for chat. See attached file:`, 
      files: [attachment] 
    });
  }
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

  if (interaction.commandName === COMMANDS.ADMIN_REWARD.name) {
    await handleAdminReward(client, interaction);
    return;
  }

  if (interaction.commandName === COMMANDS.ADMIN_GET_CODES.name) {
    await handleAdminGetCodes(client, interaction);
    return;
  }

  if (interaction.commandName === COMMANDS.ADMIN_GET_GAMES.name) {
    await handleAdminGetGames(client, interaction);
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
