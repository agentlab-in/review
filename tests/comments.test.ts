import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addComment, listComments, removeComments } from "../src/lib/comments.js";
import { ensureProject } from "../src/lib/project.js";

let scratch = "";
let savedHome: string | undefined;
let site = "";

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "alab-review-comments-"));
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

describe("comments", () => {
  it("assigns sequential ids c1, c2, ...", () => {
    const c1 = addComment(site, { page: "/", selector: "h1", tag: "h1", body: "First" });
    const c2 = addComment(site, { page: "/", selector: "p", tag: "p", body: "Second" });
    expect(c1.id).toBe("c1");
    expect(c2.id).toBe("c2");
    expect(listComments(site).map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("never reuses ids after a single remove", () => {
    addComment(site, { body: "First" });
    addComment(site, { body: "Second" });
    expect(removeComments(site, "c1")).toEqual({ removed: ["c1"] });
    const c3 = addComment(site, { body: "Third" });
    expect(c3.id).toBe("c3");
    expect(listComments(site).map((c) => c.id)).toEqual(["c2", "c3"]);
  });

  it("removes all comments but keeps the counter", () => {
    addComment(site, { body: "First" });
    addComment(site, { body: "Second" });
    expect(removeComments(site, "all")).toEqual({ removed: ["c1", "c2"] });
    expect(listComments(site)).toEqual([]);
    expect(addComment(site, { body: "Third" }).id).toBe("c3");
  });

  it("rejects bad targets and unknown ids", () => {
    expect(() => removeComments(site, "c0")).toThrow(/cN|all/);
    expect(() => removeComments(site, "bogus")).toThrow(/cN|all/);
    expect(() => removeComments(site, "c9")).toThrow(/Unknown comment/);
  });

  it("rejects empty bodies", () => {
    expect(() => addComment(site, { body: "  " })).toThrow(/empty/);
  });
});
