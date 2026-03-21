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
  /**
   * Admin-only command to overwrite a user's code and deliver reward directly.
   * Access is restricted at runtime to ADMIN_USER_ID via adminCommandHandler.
   */
  ADMIN_OVERWRITE: {
    name: 'admin-overwrite',
    description: 'Admin override for user reward flow',
    deploy: true,
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
