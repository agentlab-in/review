import { listComments } from "../lib/comments.js";
import { rematchComments } from "../lib/rematch.js";
import { resolveTargetDir } from "../lib/target.js";

export interface ListOptions {
  dir?: string;
  project?: string;
  rematch?: boolean;
  json?: boolean;
}

export function listCommand(options: ListOptions): void {
  const dir = resolveTargetDir(options);
  if (options.rematch) rematchComments(dir);
  const comments = listComments(dir);
  if (options.json) {
    console.log(JSON.stringify(comments, null, 2));
    return;
  }
  if (comments.length === 0) {
    console.log("No review comments yet.");
    return;
  }
  for (const comment of comments) {
    const flag = comment.matched ? "" : " [unmatched]";
    console.log(`${comment.id}${flag} ${comment.page} ${comment.selector} <${comment.tag}>`);
    if (comment.textSnippet) console.log(`  on: "${comment.textSnippet.slice(0, 120)}"`);
    console.log(`  ${comment.body}`);
  }
}
