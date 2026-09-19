import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureProject, readProjectId } from "../src/lib/project.js";

let scratch = "";
let savedHome: string | undefined;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "alab-review-project-"));
  savedHome = process.env.ALAB_HOME;
  process.env.ALAB_HOME = join(scratch, "home");
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.ALAB_HOME;
  else process.env.ALAB_HOME = savedHome;
  rmSync(scratch, { recursive: true, force: true });
});

describe("project store", () => {
  it("creates an 8-char lowercase alphanumeric id under <dir>/.alab/", () => {
    const site = mkdtempSync(join(scratch, "site-"));
    const { projectId, dir } = ensureProject(site);

    expect(projectId).toMatch(/^[a-z0-9]{8}$/);
    expect(dir).toBe(site);
    expect(readFileSync(join(site, ".alab", "id"), "utf8").trim()).toBe(projectId);
    const review = JSON.parse(readFileSync(join(site, ".alab", "review.json"), "utf8"));
    expect(review).toMatchObject({ projectId, version: 1, counter: 0, comments: [] });
  });

  it("keeps the same id on repeat runs", () => {
    const site = mkdtempSync(join(scratch, "site-"));
    const first = ensureProject(site).projectId;
    const second = ensureProject(site).projectId;
    expect(second).toBe(first);
    expect(readProjectId(site)).toBe(first);
  });

  it("rejects a single file instead of a directory", () => {
    const site = mkdtempSync(join(scratch, "site-"));
    const file = join(site, "index.html");
    expect(() => ensureProject(file)).toThrow(/directory/i);
  });

  it("rejects a missing path with a clear message", () => {
    expect(() => ensureProject(join(scratch, "nope"))).toThrow(/directory/i);
  });
});
