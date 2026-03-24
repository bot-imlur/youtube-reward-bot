const { MessageFlags } = require('discord.js');
const codeService = require('../services/codeService');
const { normalizeGame, isSupportedGame, isGlobalChannelAllowed } = require('../utils/validationUtils');
const { EVENTS } = require('../config/events');
const logger = require('../utils/logger');
const { processYouTubeRewardCommand } = require('../services/youtubeOnDemandRewardService');
const { sendClaimCodeMessage, formatErrorReply, sendRewardMessage } = require('../services/discordService');
const { GAME_CONFIG, YOUTUBE_CHANNEL_URL } = require('../config/constants');
const { STATUS } = require('../config/status');
const { COMMANDS } = require('../config/commands');

async function getValidatedGameOrReply(interaction, commandConfig) {
  const gameOptionName = commandConfig.options.GAME.name;
  const rawGame = interaction.options.getString(gameOptionName);
  const game = normalizeGame(rawGame);

  if (!isSupportedGame(game, interaction.channelId)) {
    logger.warn(EVENTS.INVALID_GAME_REQUEST, {
      userId: interaction.user.id,
      gameAttempted: rawGame
    });
    await interaction.reply({
      content: `Invalid or disabled game, or not available in this channel.`,
      flags: MessageFlags.Ephemeral
    });
    return null;
  }

  return game;
}

async function handleGenerate(client, interaction) {
  const game = await getValidatedGameOrReply(interaction, COMMANDS.GENERATE);
  if (!game) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await codeService.createCode(
    interaction.user.id,
    interaction.member?.displayName || interaction.user.username,
    game
  );

  const { fullName, videoName } = GAME_CONFIG[game];
  if (result.status === STATUS.ALREADY_USED) {
    await interaction.editReply({
      content: formatErrorReply(fullName, `You have already claimed the reward for this game`)
    });
    return;
  }

  await sendClaimCodeMessage(
    client,
    interaction.user.id,
    game,
    fullName,
    result.code,
    result.expiresAt,
    YOUTUBE_CHANNEL_URL,
    videoName
  );

  await interaction.editReply({
    content: `✅ Check your DMs for your code!`
  });
}

async function handleClaim(client, interaction) {
  const game = await getValidatedGameOrReply(interaction, COMMANDS.CLAIM);
  if (!game) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await processYouTubeRewardCommand(client, interaction.user.id, game);

  if (result.isError) {
    await interaction.editReply({
      content: formatErrorReply(result.gameFullName, result.reason)
    });
    return;
  }

  const { gameImage } = GAME_CONFIG[game];
  await sendRewardMessage(client, interaction.user.id, result.gameFullName, result.reward, gameImage);
  await interaction.editReply({
    content: `✅ Check your DMs for your reward!`
  });
}

async function handleUserCommand(client, interaction) {
  if (!isGlobalChannelAllowed(interaction.channelId)) {
    await interaction.reply({
      content: `This command can only be used in designated reward channels.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.commandName === COMMANDS.GENERATE.name) {
    await handleGenerate(client, interaction);
    return;
  }

  if (interaction.commandName === COMMANDS.CLAIM.name) {
    await handleClaim(client, interaction);
    return;
  }

  await interaction.reply({
    content: `Unknown command: /${interaction.commandName}`,
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  handleUserCommand
};
