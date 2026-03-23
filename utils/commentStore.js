/**
 * Comment Store (Video-based)
 *
 * Purpose:
 * - Maintain per-video comment processing state
 * - Prevent duplicate processing using commentId
 *
 * Design:
 * - One file per videoId
 *
 * Storage:
 * data/youtube/<videoId>.json
 */

const fs = require('fs');
const path = require('path');
const { readJsonFile, writeJsonFile } = require('./fileUtils');
const { withLock } = require('./dataLock');

const { YOUTUBE_STORE_DIR } = require('../config/constants');

const BASE_DIR = path.join(process.cwd(), YOUTUBE_STORE_DIR);

/**
 * Ensures base directory exists
 */
function ensureDir() {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

/**
 * Returns file path for a given videoId
 *
 * @param {string} videoId
 * @returns {string}
 */
function getFilePath(videoId) {
  ensureDir();
  return path.join(BASE_DIR, `${videoId}.json`);
}

/**
 * Initializes store file if it does not exist
 * 
 * Thread-Safety:
 * - Entire initialization sequence is protected by file lock.
 * - Prevents concurrent initialization from corrupting structure.
 *
 * @param {string} videoId
 * @param {string} videoName
 * @param {string} game
 */
async function initStore(videoId, videoName = null, game = null) {
  const filePath = getFilePath(videoId);

  return withLock(filePath, async () => {
    let store = {};

    if (fs.existsSync(filePath)) {
      store = readJsonFile(filePath);
    }

    // If structure is broken or empty → reinitialize
    if (
      !store.videoId ||
      !store.meta ||
      !store.comments
    ) {
      const initialData = {
        videoId,
        videoName,
        game,
        meta: {
          createdAt: Date.now(),
          lastFetchedAt: null
        },
        comments: {}
      };

      writeJsonFile(filePath, initialData);
    }
  });
}

/**
 * Checks if a comment is already processed
 * 
 * Thread-Safety:
 * - File read is protected by lock to ensure consistent view.
 * - Short lock duration (read-only).
 *
 * @param {string} videoId
 * @param {string} commentId
 * @returns {Promise<boolean>}
 */
async function isProcessed(videoId, commentId) {
  const filePath = getFilePath(videoId);

  return withLock(filePath, async () => {
    const store = readJsonFile(filePath);
    return store.comments && !!store.comments[commentId];
  });
}

/**
 * Saves a processed comment
 * 
 * Thread-Safety:
 * - Entire read-modify-write sequence is protected by file lock.
 * - Ensures comment data and metadata are atomically updated.
 *
 * @param {string} videoId
 * @param {string} commentId
 * @param {object} data
 * @returns {Promise<void>}
 */
async function saveComment(videoId, commentId, data) {
  const filePath = getFilePath(videoId);

  return withLock(filePath, async () => {
    const store = readJsonFile(filePath);

    if (!store.comments) {
      store.comments = {};
    }

    store.comments[commentId] = data;

    if (store.meta) {
      store.meta.lastFetchedAt = Date.now();
    }

    writeJsonFile(filePath, store);
  });
}

module.exports = {
  initStore,
  isProcessed,
  saveComment
};