/**
 * YouTube Service
 *
 * Purpose:
 * - Fetch top-level comments from a YouTube video
 */

const axios = require('axios');

const API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Fetch comments from a video
 *
 * @param {string} videoId
 * @returns {Promise<string[]>}
 */
async function fetchComments(videoId) {
  const url = 'https://www.googleapis.com/youtube/v3/commentThreads';

  const response = await axios.get(url, {
    params: {
      part: 'snippet',
      videoId,
      key: API_KEY,
      maxResults: 50
    }
  });

  return response.data.items.map(item => ({
  id: item.id,
  text: item.snippet.topLevelComment.snippet.textDisplay
  }));
}

module.exports = {
  fetchComments
};