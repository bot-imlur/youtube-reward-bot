/**
 * Command Deployment Script
 *
 * Responsibility:
 * - Registers slash commands with Discord for a specific server.
 *
 * Usage:
 * - Run manually when commands are added or updated:
 *     node deploy-commands.js
 *
 * Current Commands:
 * - /claim (requires "game" string input)
 */

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a reward')
    .addStringOption(option =>
      option.setName('game')
        .setDescription('Game name')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Registering commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('Commands registered successfully');
  } catch (error) {
    console.error(error);
  }
})();