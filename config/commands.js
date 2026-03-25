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
   * Admin-only command to explicitly force-generate a fresh code for a user.
   */
  ADMIN_OVERWRITE: {
    name: 'admin-overwrite',
    description: '(Admin Only)  Override to forcibly generate a new claim code for a user',
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
  },
  /**
   * Admin-only command to deliver the reward link directly to the target user.
   * Access is restricted at runtime to ADMIN_USER_ID via adminCommandHandler.
   */
  ADMIN_REWARD: {
    name: 'admin-reward',
    description: '(Admin Only) Native override to directly DM the reward to user',
    deploy: true,
    options: {
      USER_ID: {
        name: 'user-id',
        description: 'The Discord ID of the user to receive the reward',
        required: true,
        type: 'string'
      },
      GAME: {
        name: 'game',
        description: 'The game code (e.g. GTA-VC)',
        required: true,
        type: 'string'
      }
    }
  },
  ADMIN_GET_CODES: {
    name: 'admin-get-codes',
    description: '(Admin Only) View a tabular list of generated codes and their current status',
    deploy: true,
    options: {
      GAME: {
        name: 'game',
        description: 'Optional game code to filter by (e.g. GTA-VC)',
        required: false,
        type: 'string'
      }
    }
  },
  ADMIN_GET_GAMES: {
    name: 'admin-get-games',
    description: '(Admin Only) View metadata and configuration for supported games',
    deploy: true,
    options: {
      GAME: {
        name: 'game',
        description: 'Optional game code to filter by (e.g. GTA-VC)',
        required: false,
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
