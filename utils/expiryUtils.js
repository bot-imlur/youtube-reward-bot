/**
 * Expiry Utility
 *
 * Central place for all expiry-related logic.
 * Ensures consistent behavior across service, CLI, and future integrations.
 */

const { CODE_EXPIRY_MS } = require('../config/constants');

/**
 * Determines whether a code is expired
 *
 * @param {number} createdAt - Timestamp when code was created
 * @returns {boolean}
 */
function isExpired(createdAt) {
  return Date.now() - createdAt > CODE_EXPIRY_MS;
}

module.exports = {
  isExpired
};