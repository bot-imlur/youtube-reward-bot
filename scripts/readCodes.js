/**
 * Code Reader CLI
 *
 * Purpose:
 * - Provides a readable, queryable view of codes.json
 * - Displays all fields including the adminOverwrite flag
 * - Supports filtering by userId, code, game, used, expired, and adminOverwrite
 *
 * Usage:
 *   node scripts/readCodes.js
 *   node scripts/readCodes.js --user <userId>
 *   node scripts/readCodes.js --code <code>
 *   node scripts/readCodes.js --game GTA-VC
 *   node scripts/readCodes.js --used true
 *   node scripts/readCodes.js --expired true
 *   node scripts/readCodes.js --admin-overwrite true
 *
 * Flags can be combined:
 *   node scripts/readCodes.js --game GTA-VC --used false --expired false
 */

require('../config/env');
const path = require('path');
const { getCodesReader } = require('../utils/codeReader');
const { isExpired } = require('../utils/expiryUtils');
const { CODES_FILE_PATH } = require('../config/constants');

// Resolve absolute path from project root
const FILE_PATH = path.join(process.cwd(), CODES_FILE_PATH);

// CLI arguments passed by user
const args = process.argv.slice(2);

/**
 * Retrieves value for a CLI flag that expects a string argument.
 * Example: --game GTA-VC → returns "GTA-VC"
 *
 * @param {string} flag - CLI flag name (e.g. "--game")
 * @returns {string|null}
 */
function getArg(flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
}

/**
 * Retrieves value for a CLI boolean flag and parses it.
 * Example: --used true → returns true
 *
 * @param {string} flag - CLI flag name (e.g. "--used")
 * @returns {boolean|null} Parsed boolean, or null if flag not present
 */
function getBoolArg(flag) {
  const raw = getArg(flag);
  if (raw === null) return null;
  return raw.toLowerCase() === 'true';
}

/**
 * Converts timestamp into readable date-time string.
 *
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

/**
 * Transforms a raw code entry into a display-friendly row.
 * Derives the Expired field and surfaces the AdminOverwrite flag.
 *
 * @param {object} entry - Code entry from codes.json (with .code key attached by reader)
 * @returns {object} Display row
 */
function formatRow(entry) {
  return {
    Code: entry.code,
    UserId: entry.userId,
    Username: entry.username || '-',
    Used: entry.used,
    Expired: isExpired(entry.createdAt),
    AdminOverwrite: entry.adminOverwrite ?? false, // false for codes created before this field was added
    CreatedAt: formatTime(entry.createdAt)
  };
}

/**
 * Prints rows in tabular format, grouped by game, or a message if empty.
 *
 * @param {object[]} rows
 * @param {object} reader - Code reader instance for helper methods
 */
function printTable(rows, reader) {
  if (!rows.length) {
    console.log('No records found matching the specified filters.');
    return;
  }

  const grouped = reader.groupByGame(rows);

  for (const [gameName, gameCodes] of Object.entries(grouped)) {
    console.log(`\n======== GAME: ${gameName} ========`);
    console.table(gameCodes.map(formatRow));
  }
}

/**
 * Applies all active filters to an array of code entries.
 *
 * Supported filters: --game, --used, --expired, --admin-overwrite
 *
 * @param {object[]} entries - Raw code entries
 * @returns {object[]} Filtered entries
 */
function applyFilters(entries) {
  const gameFilter = getArg('--game');
  const usedFilter = getBoolArg('--used');
  const expiredFilter = getBoolArg('--expired');
  const adminOverwriteFilter = getBoolArg('--admin-overwrite');

  return entries.filter(entry => {
    if (gameFilter !== null && entry.game.toUpperCase() !== gameFilter.toUpperCase()) return false;
    if (usedFilter !== null && entry.used !== usedFilter) return false;
    if (expiredFilter !== null && isExpired(entry.createdAt) !== expiredFilter) return false;
    if (adminOverwriteFilter !== null && (entry.adminOverwrite ?? false) !== adminOverwriteFilter) return false;
    return true;
  });
}

/**
 * Main CLI execution flow:
 * - Reads all data via code reader
 * - Applies exact-match filters (--code, --user) first for fast lookups
 * - Falls through to general filter pipeline for all other flags
 * - Prints results as a table
 */
function main() {
  const reader = getCodesReader(FILE_PATH);

  const codeArg = getArg('--code');
  const userArg = getArg('--user');

  // Exact lookup by code (fast path — no further filtering applied)
  if (codeArg) {
    const result = reader.findByCode(codeArg);
    printTable(result ? [result] : [], reader);
    return;
  }

  // Exact lookup by user, then apply remaining filters
  if (userArg) {
    const results = reader.findByUser(userArg);
    printTable(applyFilters(results), reader);
    return;
  }

  // Default: all entries through the filter pipeline
  printTable(applyFilters(reader.getAll()), reader);
}

main();