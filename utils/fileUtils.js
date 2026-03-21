/**
 * File Utilities Module
 *
 * Responsibility:
 * - Provides generic helper functions for reading and writing JSON files.
 * - Acts as a thin abstraction over filesystem operations.
 *
 * Design Notes:
 * - Keeps file I/O logic separate from business logic.
 * - Reusable across multiple services.
 * - Returns empty object if file does not exist.
 *
 * Constraints:
 * - Uses synchronous file operations (acceptable for small-scale usage).
 */

const fs = require('fs');

/**
 * Reads JSON file and returns parsed object.
 * Returns empty object if file does not exist.
 */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

/**
 * Writes object to file in formatted JSON.
 */
function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  readJsonFile,
  writeJsonFile
};