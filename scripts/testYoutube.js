require('dotenv').config();

const { fetchComments } = require('../services/youtubeCommentService');

const VIDEO_ID = 'hkOkpwLUzjs';

/**
 * Extract video ID from URL:
 * https://www.youtube.com/watch?v=VIDEO_ID
 */

async function main() {
  try {
    const comments = await fetchComments(VIDEO_ID);

    console.log("Total comments:", comments.length);

    console.log("\nSample comments:\n");
    comments.slice(0, 10).forEach((c, i) => {
      console.log(`${i + 1}. ${c}`);
    });

  } catch (err) {
    console.error("Error fetching comments:", err.response?.data || err.message);
  }
}

main();