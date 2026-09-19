import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { assertValidProjectId } from "./project.js";

const INDEX_FILE_NAME = "review-index.json";

function alabHome(): string {
  return process.env.ALAB_HOME ?? join(homedir(), ".alab");
}

function indexPath(): string {
  return join(alabHome(), INDEX_FILE_NAME);
}

function readIndex(): Record<string, string> {
  const path = indexPath();
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Unreadable review index at ${path}. Delete it or set ALAB_HOME to a scratch dir.`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Unreadable review index at ${path}. Delete it or set ALAB_HOME to a scratch dir.`);
  }
  return parsed as Record<string, string>;
}

function writeIndex(index: Record<string, string>): void {
  const path = indexPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(index, null, 2) + "\n");
}

/** Map a project id to its folder so `--project <id>` can resume later. */
export function registerProject(projectId: string, dir: string): void {
  const index = readIndex();
  index[assertValidProjectId(projectId)] = dir;
  writeIndex(index);
}

export function unregisterProject(projectId: string): void {
  const id = assertValidProjectId(projectId);
  const index = readIndex();
  delete index[id];
  writeIndex(index);
}

/** Resolve a project id to its folder, or fail with a clear message. */
export function resolveProjectDir(projectId: string): string {
  const id = assertValidProjectId(projectId);
  const dir = readIndex()[id];
  if (!dir) {
    throw new Error(
      `Unknown project "${id}". The id to folder map lives at ${indexPath()}. ` +
        `Start the server from the folder once, or set ALAB_HOME to the home that knows it.`,
    );
  }
  return dir;
}
