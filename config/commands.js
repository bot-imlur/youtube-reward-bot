const COMMANDS = {
  GENERATE: {
    name: 'generate',
    description: 'Generate code for the game',
    deploy: true,
    options: {
      GAME: {
        name: 'game',
        description: 'Game name',
        required: true,
        type: 'string'
      }
    }
  },
  CLAIM: {
    name: 'claim',
    description: 'Claim your reward after commenting on YouTube',
    deploy: true,
    options: {
      GAME: {
        name: 'game',
        description: 'Game name',
        required: true,
        type: 'string'
      }
    }
  },
  ADMIN_OVERWRITE: {
    name: 'admin-overwrite',
    description: 'Admin override for user reward flow',
    deploy: false,
    options: {
      USER_ID: {
        name: 'user_id',
        description: 'Target Discord user ID',
        required: true,
        type: 'string'
      },
      GAME: {
        name: 'game',
        description: 'Game name',
        required: true,
        type: 'string'
      }
    }
  }
};

function isAdminCommand(commandName) {
  return commandName.startsWith('admin-');
}

module.exports = {
  COMMANDS,
  isAdminCommand
};
