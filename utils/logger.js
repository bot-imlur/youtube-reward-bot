/**
 * Logger Utility
 *
 * Purpose:
 * - Provides structured logging for the application
 * - Writes logs to a file in JSON format (one log per line)
 *
 * Design:
 * - Each log entry includes:
 *     timestamp → when event occurred
 *     level     → INFO / WARN / ERROR
 *     event     → event name (from EVENTS)
 *     data      → additional context (flattened)
 *
 * - Logs are written in append mode
 * - Ensures log directory exists before writing
 *
 * Notes:
 * - This is a synchronous logger (simple + reliable for small scale)
 * - Logs are machine-readable (JSON) and can be parsed via CLI tools
 */

const fs = require('fs');
const path = require('path');

// Absolute path to log file
const LOG_FILE = path.join(__dirname, '../logs/app.log');

// Ensure logs directory exists (prevents ENOENT crash)
const logDir = path.dirname(LOG_FILE);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Core log writer
 *
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} event - Event name (from EVENTS)
 * @param {object} data  - Additional context data
 */
function writeLog(level, event, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data
  };

  // Append log entry as a single JSON line
  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
}

/**
 * Logs informational events (normal flow)
 */
function info(event, data) {
  writeLog('INFO', event, data);
}

/**
 * Logs warning events (unexpected but non-fatal)
 */
function warn(event, data) {
  writeLog('WARN', event, data);
}

/**
 * Logs error events (failures)
 */
function error(event, data) {
  writeLog('ERROR', event, data);
}

module.exports = {
  info,
  warn,
  error
};