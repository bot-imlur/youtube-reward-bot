/**
 * YouTube Comment Data Store Lookup
 *
 * Responsibility:
 * - Query the per-video comment store for code validation results.
 * - Used by the /claim flow to check if a user's code has already been
 *   validated before triggering a fresh YouTube API fetch.
 *
 * Note: Queries data/youtube/{videoId}.json (the comment store),
 * not codes.json. These are separate concerns.
 */

const path = require('path');
const fs = require('fs');
const { readJsonFile } = require('./fileUtils');
const logger = require('./logger');

const YOUTUBE_DIR = path.join(process.cwd(), 'data/youtube');

/**
 * Returns the file path for a video's comment store.
 *
 * @param {string} videoId
 * @returns {string}
 */
function getCommentStorePath(videoId) {
  return path.join(YOUTUBE_DIR, `${videoId}.json`);
}

/**
 * Searches the YouTube comment store for a specific code's validation result.
 *
 * If the same code appears in multiple comments (e.g. duplicate submissions),
 * the LATEST processed entry is returned regardless of success or failure.
 *
 * @param {string} videoId
 * @param {string} code - The claim code to search for
 * @returns {object|null}
 *   {
 *     commentId,
 *     found: true,
 *     validation: { success, reason, userId?, ... },
 *     raw: "original comment text",
 *     processedAt: timestamp
 *   }
 *   Returns null if the code has not been seen in the store yet.
 */
function findCodeInCommentStore(videoId, code) {
  const storePath = getCommentStorePath(videoId);

  if (!fs.existsSync(storePath)) {
    logger.info('COMMENT_STORE_NOT_FOUND', { videoId, storePath });
    return null;
  }

  const store = readJsonFile(storePath);

  if (!store.comments) {
    logger.info('COMMENT_STORE_EMPTY', { videoId });
    return null;
  }

  // Collect all comments that contain this code (duplicate submissions possible)
  const allMatches = [];

  for (const [commentId, commentData] of Object.entries(store.comments)) {
    if (commentData.parsed && commentData.parsed.code === code) {
      allMatches.push({
        commentId,
        found: true,
        validation: commentData.validation,
        raw: commentData.raw,
        processedAt: commentData.meta?.processedAt,
        timestamp: commentData.meta?.processedAt || 0
      });
    }
  }

  if (allMatches.length === 0) {
    return null;
  }

  // Return the latest entry in case of duplicates
  return allMatches.reduce((latest, current) =>
    (current.timestamp > latest.timestamp) ? current : latest
  );
}

/**
 * Returns true if a code was successfully validated in the comment store.
 *
 * @param {string} videoId
 * @param {string} code
 * @returns {boolean}
 */
function isCodeSuccessfulInCommentStore(videoId, code) {
  const result = findCodeInCommentStore(videoId, code);
  return result && result.validation && result.validation.success === true;
}

/**
 * Returns the raw validation object for a code from the comment store.
 *
 * @param {string} videoId
 * @param {string} code
 * @returns {object|null}
 */
function getCodeValidationFromCommentStore(videoId, code) {
  const result = findCodeInCommentStore(videoId, code);
  return result ? result.validation : null;
}

module.exports = {
  findCodeInCommentStore,
  isCodeSuccessfulInCommentStore,
  getCodeValidationFromCommentStore,
  getCommentStorePath
};
