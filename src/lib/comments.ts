import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { unregisterProject } from "./index-store.js";
import { ALAB_DIR_NAME, REVIEW_FILE_NAME, readProjectId } from "./project.js";

export interface ReviewComment {
  id: string;
  page: string;
  selector: string;
  tag: string;
  textSnippet: string;
  body: string;
  createdAt: string;
  matched: boolean;
}

export interface ReviewFile {
  projectId: string;
  version: 1;
  counter: number;
  comments: ReviewComment[];
}

export interface NewComment {
  page?: string;
  selector?: string;
  tag?: string;
  textSnippet?: string;
  body: string;
}

const COMMENT_ID_RE = /^c[1-9][0-9]*$/;

function reviewPath(dir: string): string {
  return join(resolve(dir), ALAB_DIR_NAME, REVIEW_FILE_NAME);
}

function blankReview(projectId: string): ReviewFile {
  return { projectId, version: 1, counter: 0, comments: [] };
}

/** Load review.json. Throws when the folder has no review project yet. */
export function loadReview(targetDir: string): ReviewFile {
  const dir = resolve(targetDir);
  const path = reviewPath(dir);
  if (!existsSync(path)) {
    throw new Error(`No review project in ${dir}. Run review start on that folder first.`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ReviewFile>;
  const projectId = readProjectId(dir) ?? "";
  return {
    projectId: typeof parsed.projectId === "string" ? parsed.projectId : projectId,
    version: 1,
    counter: typeof parsed.counter === "number" ? parsed.counter : 0,
    comments: Array.isArray(parsed.comments) ? (parsed.comments as ReviewComment[]) : [],
  };
}

export function saveReview(targetDir: string, file: ReviewFile): void {
  writeFileSync(reviewPath(targetDir), JSON.stringify(file, null, 2) + "\n");
}

export function listComments(targetDir: string): ReviewComment[] {
  return loadReview(targetDir).comments;
}

/** Append a comment with the next sequential id (c1, c2, ...). Ids are never reused. */
export function addComment(targetDir: string, input: NewComment): ReviewComment {
  if (!input.body || input.body.trim() === "") {
    throw new Error("Comment body must not be empty.");
  }
  const file = loadReview(targetDir);
  const comment: ReviewComment = {
    id: `c${file.counter + 1}`,
    page: (input.page ?? "/").trim() || "/",
    selector: (input.selector ?? "").trim(),
    tag: (input.tag ?? "").trim().toLowerCase(),
    textSnippet: (input.textSnippet ?? "").trim().slice(0, 500),
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
    matched: true,
  };
  file.counter += 1;
  file.comments.push(comment);
  saveReview(targetDir, file);
  return comment;
}

export function assertValidCommentTarget(target: string): string {
  const normalized = target.trim().toLowerCase();
  if (normalized !== "all" && !COMMENT_ID_RE.test(normalized)) {
    throw new Error(`Invalid comment target "${target}". Use cN like c1, or all.`);
  }
  return normalized;
}

/**
 * Remove one comment (cN) or all of them. The counter never moves
 * backwards, so ids are never reused within a project.
 */
export function removeComments(targetDir: string, target: string): { removed: string[] } {
  const normalized = assertValidCommentTarget(target);
  const file = loadReview(targetDir);
  if (normalized === "all") {
    const removed = file.comments.map((comment) => comment.id);
    file.comments = [];
    saveReview(targetDir, file);
    return { removed };
  }
  const index = file.comments.findIndex((comment) => comment.id === normalized);
  if (index === -1) {
    throw new Error(`Unknown comment "${normalized}" in ${resolve(targetDir)}. It may already be removed.`);
  }
  file.comments.splice(index, 1);
  saveReview(targetDir, file);
  return { removed: [normalized] };
}

/** Delete `<dir>/.alab/` entirely and forget the id to folder mapping. */
export function cleanupReview(targetDir: string): { dir: string; projectId: string | null } {
  const dir = resolve(targetDir);
  const projectId = readProjectId(dir);
  rmSync(join(dir, ALAB_DIR_NAME), { recursive: true, force: true });
  if (projectId) unregisterProject(projectId);
  return { dir, projectId };
}
