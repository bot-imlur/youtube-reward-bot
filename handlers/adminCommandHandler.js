const { MessageFlags } = require('discord.js');

async function handleAdminCommand(_client, interaction) {
  await interaction.reply({
    content: `Unknown admin command: /${interaction.commandName}`,
    flags: MessageFlags.Ephemeral
  });
}

module.exports = {
  handleAdminCommand
};
