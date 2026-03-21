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
const { routeInteraction } = require('./handlers/interactionRouter');

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
  try {
    await routeInteraction(client, interaction);
  } catch (err) {
    console.error('ERROR in interaction router:', err);

    if (interaction.deferred) {
      await interaction.editReply({ content: 'Something went wrong. Try again later.' });
      return;
    }

    if (interaction.replied) {
      await interaction.followUp({
        content: 'Something went wrong. Try again later.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.reply({
      content: 'Something went wrong. Try again later.',
      flags: MessageFlags.Ephemeral
    });
  }
});

client.login(process.env.BOT_TOKEN);