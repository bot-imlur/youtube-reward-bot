/**
 * Log Reader CLI
 *
 * Purpose:
 * - Reads JSON logs from logs/app.log
 * - Displays them in a readable table
 * - Supports filtering by:
 *     --event
 *     --user
 *     --code
 *     --level
 *     --last (e.g. 5m, 2h, 1d)
 *     --today
 *
 * Example Usage:
 *   node scripts/readLogs.js
 *   node scripts/readLogs.js --last 10m
 *   node scripts/readLogs.js --level INFO
 *   node scripts/readLogs.js --today --event CODE_CREATED
 */

const fs = require('fs');
const path = require('path');

// Path to log file
const LOG_FILE = path.join(__dirname, '../logs/app.log');

// CLI arguments
const args = process.argv.slice(2);

/**
 * Returns value of a CLI argument.
 * Example: --level INFO → "INFO"
 */
function getArg(flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
}

/**
 * Checks if a flag exists (boolean flag).
 * Example: --today
 */
function hasFlag(flag) {
  return args.includes(flag);
}

/**
 * Reads log file and parses each line as JSON.
 * Each line is treated as a separate log entry.
 */
function readLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];

  const lines = fs.readFileSync(LOG_FILE, 'utf-8')
    .split('\n')
    .filter(Boolean);

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Converts duration string into milliseconds.
 * Supported formats:
 *   5m → minutes
 *   2h → hours
 *   1d → days
 */
function parseDuration(value) {
  if (!value) return null;

  const match = value.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;

  const num = Number(match[1]);
  const unit = match[2];

  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;

  return null;
}

/**
 * Formats a log entry into a display-friendly object.
 */
function formatLog(log) {
  return {
    Time: new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    Level: log.level,
    Event: log.event,
    UserId: log.userId || log.targetUserId || '-',
    Username: log.username || log.targetUsername || '-',
    Code: log.code || '-',
    Game: log.game || log.gameAttempted || '-'
  };
}

/**
 * Prints logs using console.table.
 */
function printLogs(logs) {
  if (!logs.length) {
    console.log('No logs found');
    return;
  }

  console.table(logs.map(formatLog));
}

/**
 * Applies all supported filters:
 * - event
 * - user
 * - code
 * - level
 * - time (last / today)
 */
function applyFilters(logs) {
  const eventArg = getArg('--event');
  const userArg = getArg('--user');
  const codeArg = getArg('--code');
  const levelArg = getArg('--level');

  const lastArg = getArg('--last');
  const isToday = hasFlag('--today');

  let fromTime = null;

  // Calculate time window from --last
  if (lastArg) {
    const duration = parseDuration(lastArg);
    if (duration) {
      fromTime = Date.now() - duration;
    }
  }

  // Calculate start of today if --today is provided
  if (isToday) {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    fromTime = startOfDay.getTime();
  }

  return logs.filter(log => {
    if (eventArg && log.event !== eventArg) return false;
    if (userArg && log.userId !== userArg) return false;
    if (codeArg && log.code !== codeArg) return false;
    if (levelArg && log.level !== levelArg) return false;

    if (fromTime) {
      const logTime = new Date(log.timestamp).getTime();
      if (logTime < fromTime) return false;
    }

    return true;
  });
}

/**
 * Entry point:
 * - Reads logs
 * - Applies filters
 * - Prints results
 */
function main() {
  const logs = readLogs();
  const filtered = applyFilters(logs);
  printLogs(filtered);
}

main();