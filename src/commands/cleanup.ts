import { cleanupReview } from "../lib/comments.js";
import { resolveTargetDir } from "../lib/target.js";

export interface CleanupOptions {
  dir?: string;
  project?: string;
  json?: boolean;
}

/** Delete `<dir>/.alab/` entirely and forget the project mapping. */
export function cleanupCommand(options: CleanupOptions): void {
  const dir = resolveTargetDir(options);
  const result = cleanupReview(dir);
  if (options.json) {
    console.log(JSON.stringify({ cleaned: true, dir: result.dir, projectId: result.projectId }));
  } else {
    console.log(`Removed review state at ${result.dir}/.alab/`);
  }
}
