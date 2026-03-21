/**
 * Code Reader CLI
 *
 * Purpose:
 * - Provides a readable, queryable view of codes.json
 * - Supports filtering by userId and code
 * - Displays derived fields (e.g., Expired) for better observability
 *
 * Usage:
 *   node scripts/readCodes.js
 *   node scripts/readCodes.js --user <userId>
 *   node scripts/readCodes.js --code <code>
 */

const path = require('path');
const { getCodesReader } = require('../utils/codeReader');
const { isExpired } = require('../utils/expiryUtils');
const { CODES_FILE_PATH } = require('../config/constants');

// Resolve absolute path from project root
const FILE_PATH = path.join(process.cwd(), CODES_FILE_PATH);

// CLI arguments passed by user
const args = process.argv.slice(2);

/**
 * Retrieves value for a CLI flag.
 * Example:
 *   --user 123 → returns "123"
 */
function getArg(flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
}

/**
 * Converts timestamp into readable date-time string.
 */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

/**
 * Transforms raw entry into display-friendly format.
 * Adds derived fields like "Expired".
 */
function formatRow(entry) {
  return {
    Code: entry.code,
    UserId: entry.userId,
    Game: entry.game,
    Username: entry.username || '-',
    Used: entry.used,
    Expired: isExpired(entry.createdAt),

    CreatedAt: formatTime(entry.createdAt)
  };
}

/**
 * Prints rows in tabular format.
 */
function printTable(rows) {
  if (!rows.length) {
    console.log('No records found');
    return;
  }

  console.table(rows.map(formatRow));
}

/**
 * Main CLI execution flow:
 * - Reads data
 * - Applies filters (if any)
 * - Prints results
 */
function main() {
  const reader = getCodesReader(FILE_PATH);

  const codeArg = getArg('--code');
  const userArg = getArg('--user');

  // Filter by specific code
  if (codeArg) {
    const result = reader.findByCode(codeArg);
    printTable(result ? [result] : []);
    return;
  }

  // Filter by user
  if (userArg) {
    const results = reader.findByUser(userArg);
    printTable(results);
    return;
  }

  // Default: show all entries
  printTable(reader.getAll());
}

main();