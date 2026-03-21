/**
 * YouTube Comment Data Store Lookup
 *
 * Responsibility:
 * - Query youtube data store for code validation results
 * - Search for user's comments with specific codes
 * - Helper functions for /yt command logic
 *
 * Note: This queries the YOUTUBE comment store (data/youtube/{videoId}.json),
 * not the codes.json file. Different from codeService which manages code lifecycle.
 */

const path = require('path');
const fs = require('fs');
const { readJsonFile } = require('./fileUtils');

const YOUTUBE_DIR = path.join(process.cwd(), 'data/youtube');

/**
 * Get file path for a video's comment store
 */
function getCommentStorePath(videoId) {
  return path.join(YOUTUBE_DIR, `${videoId}.json`);
}

/**
 * Search youtube comment store for a specific code's validation result
 * 
 * @param {string} videoId
 * @param {string} code - The claim code to search for
 * @returns {Object|null} 
 *   {
 *     commentId,
 *     found: true,
 *     validation: { success, reason, userId?, ... },
 *     raw: "original comment text",
 *     processedAt: timestamp
 *   }
 *   Returns the LATEST validation (successful OR failed) for this code.
 *   Returns null if code not found in store at all.
 */
function findCodeInCommentStore(videoId, code) {
  const storePath = getCommentStorePath(videoId);
  
  if (!fs.existsSync(storePath)) {
    console.log(`[findCodeInCommentStore] Store file not found: ${storePath}`);
    return null;
  }
  
  const store = readJsonFile(storePath);
  
  if (!store.comments) {
    console.log(`[findCodeInCommentStore] No comments in store`);
    return null;
  }
  
  console.log(`[findCodeInCommentStore] Searching for code "${code}" in ${Object.keys(store.comments).length} comments`);
  
  // Search all comments for this code, collect ALL matches (success OR failed)
  const allMatches = [];
  
  for (const [commentId, commentData] of Object.entries(store.comments)) {
    if (commentData.parsed && commentData.parsed.code === code) {
      console.log(`[findCodeInCommentStore] Found comment with code ${code}:`, commentData.validation);
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
  
  // If we found any matches, return the LATEST one (regardless of success/failure)
  if (allMatches.length > 0) {
    console.log(`[findCodeInCommentStore] Found ${allMatches.length} matches for code ${code}`);
    return allMatches.reduce((latest, current) => 
      (current.timestamp > latest.timestamp) ? current : latest
    );
  }
  
  console.log(`[findCodeInCommentStore] No validation found for code ${code}`);
  return null;
}

/**
 * Check if a code was successfully validated in youtube comment store
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
 * Get the validation result for a code from comment store
 * 
 * @param {string} videoId
 * @param {string} code
 * @returns {Object|null} - validation object with success, reason, userId, game
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
