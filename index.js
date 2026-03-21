/**
 * Application Entry Point
 *
 * Responsibility:
 * - Initializes and runs the Discord bot.
 * - Handles incoming slash commands.
 * - Delegates business logic to services.
 *
 * Current Features:
 * - Supports /claim command.
 * - Generates or retrieves user-specific code.
 *
 * Flow:
 * User → Discord → index.js → codeService → response
 */

require('dotenv').config();
const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const codeService = require('./services/codeService');
const { normalizeGame, isSupportedGame, isGlobalChannelAllowed } = require('./utils/validationUtils');
const { EVENTS } = require('./config/events');
const logger = require('./utils/logger');

const { processComments } = require('./services/youtubeClaimProcessor');
const { processYouTubeRewardCommand } = require('./services/youtubeOnDemandRewardService');
const { sendClaimCodeMessage, formatErrorReply, sendRewardMessage } = require('./services/discordService');
const { GAME_CONFIG } = require('./config/constants');
const { STATUS } = require('./config/status');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/**
 * Triggered when bot successfully connects.
 */
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/**
 * Handles all incoming slash commands.
 */
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Check channel restriction for all commands
  if (!isGlobalChannelAllowed(interaction.channelId)) {
    await interaction.reply({
      content: `This command can only be used in designated reward channels.`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.commandName === 'claim') {
    try {
      const rawGame = interaction.options.getString('game');
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
        return;
    }

      const result = await codeService.createCode(
        interaction.user.id,
        interaction.member?.displayName || interaction.user.username,
        game
      );

      const { fullName, gameImage } = GAME_CONFIG[game];
      if (result.status === STATUS.ALREADY_USED) {
        // Send error as ephemeral message on channel
        await interaction.reply({
          content: formatErrorReply(fullName, `You have already claimed the reward for this game`),
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      // Send code to user via DM
      await sendClaimCodeMessage(
        client,
        interaction.user.id,
        game,
        fullName,
        result.code,
        result.expiresAt
      );

      // Reply on channel confirming DM was sent
      await interaction.reply({
        content: `✅ Check your DMs for your code!`,
        flags: MessageFlags.Ephemeral
      });
    } catch (err) {
      console.error("ERROR in /claim:", err);

      await interaction.reply({
        content: "Something went wrong. Try again later.",
        flags: MessageFlags.Ephemeral
      });
    }
  } else if (interaction.commandName === 'yt') {
    try {
      const rawGame = interaction.options.getString('game');
      const game = normalizeGame(rawGame);
      if (!isSupportedGame(game,  interaction.channelId)) {
        logger.warn(EVENTS.INVALID_GAME_REQUEST, {
            userId: interaction.user.id,
            gameAttempted: rawGame
        });
        await interaction.reply({
            content: `Invalid or disabled game., or not available in this channel.`,
            flags: MessageFlags.Ephemeral
        });
        return;
      }

      // Defer reply since processor might take time
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await processYouTubeRewardCommand(client, interaction.user.id, game);

      if (result.isError) {
        // Send error as ephemeral message on channel
        await interaction.editReply({
          content: formatErrorReply(result.gameFullName, result.reason)
        });
      } else {
        // Send reward via DM
        const { gameImage } = GAME_CONFIG[game];
        await sendRewardMessage(client, interaction.user.id, result.gameFullName, result.reward, gameImage);
        
        // Notify user to check DM
        await interaction.editReply({
          content: `✅ Check your DMs for your reward!`
        });
      }
    } catch (err) {
      console.error("ERROR in /yt:", err);

      await interaction.editReply({
        content: "Something went wrong. Try again later."
      });
    }
  }
});

client.login(process.env.BOT_TOKEN);