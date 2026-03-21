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
const { normalizeGame, isSupportedGame, getEnabledGames } = require('./utils/validationUtils');
const { EVENTS } = require('./config/events');
const logger = require('./utils/logger');

const { processComments } = require('./services/youtubeClaimProcessor');
const { sendDM } = require('./services/discordService');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/**
 * Triggered when bot successfully connects.
 */
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  // TEMP: Run YouTube processing once on startup
  try {

    const game = "GTA-VC"; // change as needed

    console.log(`[YouTube] Processing for game: ${game}`);

    const results = await processComments(game);

    console.log(`[YouTube] Found ${results.length} valid claims`);

    for (const r of results) {
      await sendDM(
        client,
        r.userId,
        `Reward unlocked for ${r.game}\n\nKey: ${r.reward}`
      );
    }

    console.log("[YouTube] Processing complete");
  } catch (err) {
    console.error("[YouTube] Error:", err.message);
  }
});

/**
 * Handles all incoming slash commands.
 */
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'claim') {
    try {
      const rawGame = interaction.options.getString('game');
      const game = normalizeGame(rawGame);
      if (!isSupportedGame(game)) {
        logger.warn(EVENTS.INVALID_GAME_REQUEST, {
            userId: interaction.user.id,
            gameAttempted: rawGame
        });
        await interaction.reply({
            content: `Invalid or disabled game. Available: ${getEnabledGames().join(', ')}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

      const result = codeService.createCode(
        interaction.user.id,
        interaction.member?.displayName || interaction.user.username,
        game
     );

      await interaction.reply({
        content: `Game: ${game}\nCode: ${result.code}\nStatus: ${result.status}`,
        flags: MessageFlags.Ephemeral
      });
    } catch (err) {
      console.error("ERROR in /claim:", err);

      await interaction.reply({
        content: "Something went wrong. Try again later.",
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

client.login(process.env.BOT_TOKEN);