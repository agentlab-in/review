import { cleanupReview, removeComments } from "../lib/comments.js";
import { resolveTargetDir } from "../lib/target.js";

export interface RemoveOptions {
  dir?: string;
  project?: string;
  removeComments?: string;
  clean?: boolean;
  cleanup?: boolean;
  json?: boolean;
}

/**
 * Remove comments by id (`--remove-comments c1`), all of them
 * (`--remove-comments all` or `--clean`), or delete `.alab/` (`--cleanup`).
 */
export function removeCommand(options: RemoveOptions): void {
  const dir = resolveTargetDir(options);
  if (options.cleanup) {
    const result = cleanupReview(dir);
    if (options.json) {
      console.log(JSON.stringify({ cleaned: true, dir: result.dir, projectId: result.projectId }));
    } else {
      console.log(`Removed review state at ${result.dir}/.alab/`);
    }
    return;
  }
  const target = options.clean ? "all" : options.removeComments;
  if (!target) {
    throw new Error("Pass --remove-comments <cN|all>, --clean, or --cleanup.");
  }
  const result = removeComments(dir, target);
  if (options.json) {
    console.log(JSON.stringify({ removed: result.removed }));
  } else if (result.removed.length === 0) {
    console.log("Nothing to remove.");
  } else {
    console.log(`Removed ${result.removed.join(", ")}`);
  }
}
