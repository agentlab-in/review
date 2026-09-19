import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addComment, cleanupReview, listComments, removeComments } from "../src/lib/comments.js";
import { resolveProjectDir } from "../src/lib/index-store.js";
import { ensureProject, readProjectId } from "../src/lib/project.js";

let scratch = "";
let savedHome: string | undefined;
let site = "";

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "alab-review-cleanup-"));
  savedHome = process.env.ALAB_HOME;
  process.env.ALAB_HOME = join(scratch, "home");
  site = mkdtempSync(join(scratch, "site-"));
  ensureProject(site);
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.ALAB_HOME;
  else process.env.ALAB_HOME = savedHome;
  rmSync(scratch, { recursive: true, force: true });
});

describe("remove all versus cleanup", () => {
  it("remove all keeps the project id and review file", () => {
    const { projectId } = ensureProject(site);
    addComment(site, { body: "Keep me out" });
    removeComments(site, "all");
    expect(listComments(site)).toEqual([]);
    expect(readProjectId(site)).toBe(projectId);
    expect(existsSync(join(site, ".alab", "review.json"))).toBe(true);
  });

  it("cleanup deletes .alab/ and forgets the project mapping", () => {
    const { projectId } = ensureProject(site);
    addComment(site, { body: "Gone soon" });
    expect(resolveProjectDir(projectId)).toBe(site);

    const result = cleanupReview(site);
    expect(result).toEqual({ dir: site, projectId });
    expect(existsSync(join(site, ".alab"))).toBe(false);
    expect(() => resolveProjectDir(projectId)).toThrow(/Unknown project/);
  });
});
