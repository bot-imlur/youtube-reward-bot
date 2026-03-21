const { handleAdminCommand } = require('./adminCommandHandler');
const { handleUserCommand } = require('./userCommandHandler');
const { isAdminCommand } = require('../config/commands');

async function routeInteraction(client, interaction) {
  if (isAdminCommand(interaction.commandName)) {
    await handleAdminCommand(client, interaction);
    return;
  }

  await handleUserCommand(client, interaction);
}

module.exports = {
  routeInteraction
};
