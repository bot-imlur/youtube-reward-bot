/**
 * Environment Configuration Loader
 *
 * Responsibility:
 * - Loads the correct .env file based on the --prod CLI flag
 * - Sets NODE_ENV properly before any other modules load
 */

const isProd = process.argv.includes('--prod');
process.env.NODE_ENV = isProd ? 'production' : (process.env.NODE_ENV || 'development');

const ENV_FILE = isProd ? '.env' : '.env.development';
require('dotenv').config({ path: ENV_FILE });

module.exports = {
  isProd,
  ENV_FILE
};
