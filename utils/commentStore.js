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

const BASE_DIR = path.join(process.cwd(), 'data/youtube');

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
 * @param {string} videoId
 * @param {string} videoName
 * @param {string} game
 */
function initStore(videoId, videoName = null, game = null) {
  const filePath = getFilePath(videoId);

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
}

/**
 * Checks if a comment is already processed
 *
 * @param {string} videoId
 * @param {string} commentId
 * @returns {boolean}
 */
function isProcessed(videoId, commentId) {
  const filePath = getFilePath(videoId);
  const store = readJsonFile(filePath);

  return store.comments && !!store.comments[commentId];
}

/**
 * Saves a processed comment
 *
 * @param {string} videoId
 * @param {string} commentId
 * @param {object} data
 */
function saveComment(videoId, commentId, data) {
  const filePath = getFilePath(videoId);
  const store = readJsonFile(filePath);

  if (!store.comments) {
    store.comments = {};
  }

  store.comments[commentId] = data;

  if (store.meta) {
    store.meta.lastFetchedAt = Date.now();
  }

  writeJsonFile(filePath, store);
}

module.exports = {
  initStore,
  isProcessed,
  saveComment
};