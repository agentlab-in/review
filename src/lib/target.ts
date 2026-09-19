import { resolve } from "node:path";
import { resolveProjectDir } from "./index-store.js";

/** Shared `--dir` / `--project` resolution. Passing both is an error. */
export function resolveTargetDir(options: { dir?: string; project?: string }): string {
  if (options.project && options.dir) {
    throw new Error("Pass either a directory or --project <id>, not both.");
  }
  if (options.project) return resolveProjectDir(options.project);
  return resolve(options.dir ?? ".");
}
