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

require('./config/env');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { COMMANDS } = require('./config/commands');

function applyOption(builder, optionConfig) {
  if (optionConfig.type === 'string') {
    return builder.addStringOption(option =>
      option
        .setName(optionConfig.name)
        .setDescription(optionConfig.description)
        .setRequired(optionConfig.required)
    );
  }

  throw new Error(`Unsupported option type: ${optionConfig.type}`);
}

function buildCommand(commandConfig) {
  let builder = new SlashCommandBuilder()
    .setName(commandConfig.name)
    .setDescription(commandConfig.description);

  for (const optionConfig of Object.values(commandConfig.options || {})) {
    builder = applyOption(builder, optionConfig);
  }

  return builder.toJSON();
}

const commands = Object.values(COMMANDS)
  .filter(command => command.deploy)
  .map(buildCommand);
const deployableCommands = Object.values(COMMANDS).filter(command => command.deploy);

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Registering commands...');
    console.log(
      `[Deploy] Commands from config (${deployableCommands.length}): ` +
      deployableCommands.map(command => `/${command.name}`).join(', ')
    );

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('Commands registered successfully');
    for (const command of deployableCommands) {
      const optionNames = Object.values(command.options || {}).map(option => option.name);
      console.log(
        `[Deploy] /${command.name} | deploy=${command.deploy} | options=[${optionNames.join(', ')}]`
      );
    }
  } catch (error) {
    console.error(error);
  }
})();