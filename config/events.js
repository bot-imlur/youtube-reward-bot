/**
 * Application Event Constants
 *
 * Purpose:
 * - Defines all log event names in one place
 * - Prevents typos and inconsistent naming
 * - Documents exact meaning of each event
 *
 * Important:
 * - These are business + system lifecycle events
 * - Do NOT change names casually (affects log querying)
 */

const EVENTS = {
  /**
   * A new code was generated for a user.
   * Triggered when no valid code exists or expired (and not used).
   */
  CODE_CREATED: "CODE_CREATED",

  /**
   * An existing valid code was returned to the user.
   * No new code was generated.
   */
  CODE_EXISTING: "CODE_EXISTING",

  /**
   * A code was found expired during access and removed.
   * Happens lazily when user invokes /claim.
   */
  CODE_EXPIRED: "CODE_EXPIRED",

  /**
   * A user attempted to generate a new code,
   * but their existing code is already marked as used.
   *
   * This is a terminal state — no new code will ever be generated.
   */
  CODE_USED_NO_GENERATION: "CODE_USED_NO_GENERATION",

  /**
   * Code not found in the system.
   *
   * Triggered when a user submits a code (via YouTube or otherwise)
   * that does not exist in codes.json.
   *
   * Possible reasons:
   * - Invalid code
   * - Typo in comment
   * - Random / malicious input
   */
  CODE_NOT_FOUND: "CODE_NOT_FOUND",
  
  /**
   * Code has already been used (consumed).
   *
   * This is a terminal state — the reward has already been granted,
   * and the code cannot be reused under any circumstance.
   *
   * Any further attempts should be rejected.
   */
  CODE_ALREADY_USED: "CODE_ALREADY_USED",
  
  /**
   * Code successfully consumed.
   *
   * Triggered when:
   * - Code exists
   * - Code is not used
   * - Code is not expired
   *
   * This marks the completion of the reward lifecycle.
   * The associated reward should be delivered to the user.
   */
  CODE_CONSUMED: "CODE_CONSUMED",

  /**
   * User attempted to request an unsupported or disabled game
   */
  INVALID_GAME_REQUEST: "INVALID_GAME_REQUEST",

  /**
   * Reward successfully delivered to a user after code consumption.
   * Triggered after consumeCode succeeds and reward is dispatched.
   */
  REWARD_SENT: "REWARD_SENT",

  /**
   * Bot successfully posted a reply on the user's YouTube comment.
   * Fired after replyToComment succeeds (non-critical, best-effort).
   */
  REWARD_REPLY_POSTED: "REWARD_REPLY_POSTED",

  /**
   * An admin used /admin-overwrite to forcibly issue a new code for a user.
   * Logs both the admin invoker and the target user for full auditability.
   */
  ADMIN_CODE_OVERWRITE: "ADMIN_CODE_OVERWRITE"
};

module.exports = {
  EVENTS
};