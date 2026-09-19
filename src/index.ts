/**
 * @agentlab/review: local click-to-comment review server for static HTML folders.
 *
 * Library entry point. For the future `alab review ...` wiring, import
 * `createProgram` and `runReviewCli` from `@agentlab/review/program`
 * (this module re-exports them). Importing never parses argv, starts a
 * server, or prints anything.
 */

export { createProgram, createReviewCommand, runReviewCli, REVIEW_VERSION } from "./program.js";
export { startCommand } from "./commands/start.js";
export { listCommand } from "./commands/list.js";
export { removeCommand } from "./commands/remove.js";
export { cleanupCommand } from "./commands/cleanup.js";
export {
  ensureProject,
  readProjectId,
  generateProjectId,
  assertValidProjectId,
  isValidProjectId,
} from "./lib/project.js";
export {
  loadReview,
  saveReview,
  listComments,
  addComment,
  removeComments,
  cleanupReview,
  type ReviewComment,
  type ReviewFile,
  type NewComment,
} from "./lib/comments.js";
export { rematchComments } from "./lib/rematch.js";
export { resolveProjectDir, registerProject, unregisterProject } from "./lib/index-store.js";
export { resolveTargetDir } from "./lib/target.js";
export { startReviewServer, resolveServedPath, type ReviewServer } from "./lib/server.js";
export { injectOverlay, overlayScript } from "./lib/overlay.js";
