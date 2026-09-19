import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addComment, listComments } from "../src/lib/comments.js";
import { ensureProject } from "../src/lib/project.js";
import { rematchComments } from "../src/lib/rematch.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let scratch = "";
let savedHome: string | undefined;
let site = "";

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "alab-review-rematch-"));
  savedHome = process.env.ALAB_HOME;
  process.env.ALAB_HOME = join(scratch, "home");
  site = mkdtempSync(join(scratch, "site-"));
  cpSync(join(root, "fixtures", "site"), site, { recursive: true });
  ensureProject(site);
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.ALAB_HOME;
  else process.env.ALAB_HOME = savedHome;
  rmSync(scratch, { recursive: true, force: true });
});

describe("rematch after HTML rewrite", () => {
  it("marks rewritten targets unmatched but keeps them listed", () => {
    addComment(site, {
      page: "/index.html",
      selector: "#headline",
      tag: "h1",
      textSnippet: "Fixture headline",
      body: "Change this headline",
    });

    writeFileSync(
      join(site, "index.html"),
      "<!doctype html><html><body><h1 id=\"other\">Totally new copy</h1></body></html>\n",
    );

    const result = rematchComments(site);
    expect(result).toEqual({ matched: [], unmatched: ["c1"] });

    const comments = listComments(site);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: "c1", matched: false, body: "Change this headline" });
  });

  it("keeps matching comments matched when the text survives", () => {
    addComment(site, {
      page: "/index.html",
      selector: "#headline",
      tag: "h1",
      textSnippet: "Fixture headline",
      body: "Looks good",
    });
    const html = readFileSync(join(site, "index.html"), "utf8");
    writeFileSync(join(site, "index.html"), html.replace("</main>", "<footer>new</footer></main>"));

    expect(rematchComments(site)).toEqual({ matched: ["c1"], unmatched: [] });
    expect(listComments(site)[0]?.matched).toBe(true);
  });
});
