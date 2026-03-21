/**
 * Comment Parser
 *
 * Purpose:
 * - Extract username and code from YouTube comments
 *
 * Supported format:
 *   Jai:ABC123
 *   Jai : ABC123
 *   jai:abc123
 *
 * Rules:
 * - Split on ':' (first occurrence only)
 * - Username = left side
 * - Code = right side
 * - Code normalized to uppercase
 * - Code length controlled via CODE_LENGTH constant
 */

const { CODE_LENGTH } = require('../config/constants');

function parseComment(comment) {
  if (!comment || typeof comment !== 'string') return null;

  const cleaned = comment.trim();

  const separatorIndex = cleaned.indexOf(':');

  if (separatorIndex === -1) return null;

  const rawUsername = cleaned.slice(0, separatorIndex).trim();
  const rawCode = cleaned.slice(separatorIndex + 1).trim();

  if (!rawUsername || !rawCode) return null;

  const code = rawCode.toUpperCase();

  // Dynamic regex based on CODE_LENGTH
  const regex = new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`);

  if (!regex.test(code)) {
    return null;
  }

  return {
    username: rawUsername,
    code
  };
}

module.exports = {
  parseComment
};