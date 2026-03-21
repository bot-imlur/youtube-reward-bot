/**
 * Data Lock Module
 *
 * Responsibility:
 * - Provides file locking mechanism to ensure thread-safe read-modify-write operations.
 * - Prevents concurrent access to critical files (codes.json, video comment files).
 *
 * Design Notes:
 * - Uses proper-lockfile library for mutex-style file locking.
 * - withLock() wrapper ensures lock is always released via finally block.
 * - Timeout prevents deadlocks; retries handle transient lock conflicts.
 *
 * Constraints:
 * - Lock acquisition may fail if timeout exceeded.
 * - File must be accessible (readable/writable) for lock to work.
 */

const lockfile = require('proper-lockfile');

/**
 * Wraps a callback function with file locking mechanism.
 * Ensures that read-modify-write operations on a file are atomic.
 *
 * @param {string} filePath - Path to the file to lock
 * @param {Function} callback - Async function to execute while holding the lock
 * @returns {Promise} - Result of the callback function
 * @throws {Error} - If lock acquisition fails
 */
async function withLock(filePath, callback) {
  let release;
  try {
    // Acquire lock on the file
    release = await lockfile.lock(filePath, {
      retries: {
        retries: 50,          // Retry up to 50 times for high concurrency
        factor: 1.5,          // Slower backoff
        minTimeout: 100,      // Min 100ms between retries
        maxTimeout: 5000      // Max 5 seconds between retries
      },
      timeout: 60000         // Overall timeout of 60 seconds for sustained load
    });

    // Execute callback while holding lock
    return await callback();
  } finally {
    // Always release lock, even if callback throws
    if (release) {
      await release();
    }
  }
}

module.exports = {
  withLock
};
