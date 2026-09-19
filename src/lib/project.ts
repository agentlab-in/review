import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { registerProject } from "./index-store.js";

export const ALAB_DIR_NAME = ".alab";
export const ID_FILE_NAME = "id";
export const REVIEW_FILE_NAME = "review.json";

const PROJECT_ID_RE = /^[a-z0-9]{8}$/;

/** 8-char lowercase alphanumeric project id. */
export function generateProjectId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_RE.test(id);
}

export function assertValidProjectId(id: string): string {
  const normalized = id.trim().toLowerCase();
  if (!isValidProjectId(normalized)) {
    throw new Error(`Invalid project id "${id}". Expected 8 lowercase letters or digits.`);
  }
  return normalized;
}

export function alabDir(targetDir: string): string {
  return join(resolve(targetDir), ALAB_DIR_NAME);
}

/** Read the stored project id without creating anything. Returns null when absent. */
export function readProjectId(targetDir: string): string | null {
  const dir = resolve(targetDir);
  const idPath = join(dir, ALAB_DIR_NAME, ID_FILE_NAME);
  if (!existsSync(idPath)) return null;
  const raw = readFileSync(idPath, "utf8").trim();
  if (!raw) return null;
  return assertValidProjectId(raw);
}

/**
 * Ensure `<dir>/.alab/` exists with an id file and review.json.
 * Rejects files: review works on a directory only.
 */
export function ensureProject(targetDir: string): { dir: string; projectId: string } {
  const dir = resolve(targetDir);
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(dir);
  } catch {
    throw new Error(`Not a directory: ${dir}. Pass the folder you want reviewed.`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dir}. Review takes a folder, not a single file.`);
  }

  const home = join(dir, ALAB_DIR_NAME);
  mkdirSync(home, { recursive: true });

  const idPath = join(home, ID_FILE_NAME);
  let projectId: string;
  if (existsSync(idPath)) {
    projectId = readProjectId(dir) ?? generateProjectId();
    if (!existsSync(idPath) || readFileSync(idPath, "utf8").trim() === "") {
      writeFileSync(idPath, `${projectId}\n`);
    }
  } else {
    projectId = generateProjectId();
    writeFileSync(idPath, `${projectId}\n`);
  }

  const reviewPath = join(home, REVIEW_FILE_NAME);
  if (!existsSync(reviewPath)) {
    writeFileSync(reviewPath, JSON.stringify({ projectId, version: 1, counter: 0, comments: [] }, null, 2) + "\n");
  }

  registerProject(projectId, dir);
  return { dir, projectId };
}
