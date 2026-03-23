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

// Resolve environment before any module is loaded
// --prod flag → production (.env), default → development (.env.development)
const isProd = process.argv.includes('--prod');
process.env.NODE_ENV = isProd ? 'production' : (process.env.NODE_ENV || 'development');

const ENV_FILE = isProd ? '.env' : '.env.development';
require('dotenv').config({ path: ENV_FILE });

const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const { routeInteraction } = require('./handlers/interactionRouter');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/**
 * Triggered when bot successfully connects.
 */
client.once('clientReady', async () => {
  const mode    = isProd ? '🟢 PROD' : '🟡 DEV';
  const divider = '─'.repeat(44);
  console.log(`\n${divider}`);
  console.log(`  ${mode}  ${client.user.tag}`);
  console.log(`  Env  › ${ENV_FILE}`);
  console.log(`  Data › ${require('./config/constants').DATA_DIR}/`);
  console.log(`${divider}\n`);
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