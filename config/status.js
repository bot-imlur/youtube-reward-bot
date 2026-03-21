/**
 * Code Status Constants
 *
 * Purpose:
 * - Defines all possible user-facing states returned by the system
 * - Ensures consistent messaging between service layer and Discord responses
 * - Prevents hardcoded string usage across the codebase
 *
 * Important Distinction:
 * - STATUS → what the user sees (response state)
 * - EVENTS → what gets logged internally (system behavior)
 *
 * Design Rules:
 * - These values should remain stable (used in UI/UX)
 */

const STATUS = {
  /**
   * A new code was generated for the user
   */
  NEW: "NEW",

  /**
   * An existing valid (non-expired, unused) code was returned
   */
  EXISTING: "EXISTING",

  /**
   * The user's code is already used (reward claimed),
   * so no new code will be generated
   */
  ALREADY_USED: "ALREADY_USED"
};

module.exports = {
  STATUS
};