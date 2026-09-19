import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OVERLAY_MARKER, startReviewServer, type ReviewServer } from "../src/lib/server.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let scratch = "";
let savedHome: string | undefined;
let site = "";
let server: ReviewServer | null = null;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "alab-review-server-"));
  savedHome = process.env.ALAB_HOME;
  process.env.ALAB_HOME = join(scratch, "home");
  site = mkdtempSync(join(scratch, "site-"));
  cpSync(join(root, "fixtures", "site"), site, { recursive: true });
});

afterEach(async () => {
  await server?.close().catch(() => {});
  server = null;
  if (savedHome === undefined) delete process.env.ALAB_HOME;
  else process.env.ALAB_HOME = savedHome;
  rmSync(scratch, { recursive: true, force: true });
});

describe("review server", () => {
  it("serves HTML with the overlay injected while the disk copy stays clean", async () => {
    server = await startReviewServer({ dir: site });
    const before = readFileSync(join(site, "index.html"), "utf8");

    const res = await fetch(server.url);
    expect(res.status).toBe(200);
    const served = await res.text();
    expect(served).toContain(OVERLAY_MARKER);
    expect(served).toContain("Fixture headline");

    expect(readFileSync(join(site, "index.html"), "utf8")).toBe(before);
    expect(before).not.toContain(OVERLAY_MARKER);
  });

  it("round trips comments through the overlay API and persists them", async () => {
    server = await startReviewServer({ dir: site });

    const created = await fetch(`${server.url}__alab/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: "/", selector: "h1", tag: "h1", textSnippet: "Hi", body: "Nice" }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: "c1", body: "Nice" });

    const listed = await fetch(`${server.url}__alab/comments`);
    const payload = (await listed.json()) as { projectId: string; comments: { id: string }[] };
    expect(payload.projectId).toMatch(/^[a-z0-9]{8}$/);
    expect(payload.comments.map((c) => c.id)).toEqual(["c1"]);

    const stored = JSON.parse(readFileSync(join(site, ".alab", "review.json"), "utf8"));
    expect(stored.comments.map((c: { id: string }) => c.id)).toEqual(["c1"]);
  });

  it("blocks .alab internals and path traversal", async () => {
    server = await startReviewServer({ dir: site });

    const internal = await fetch(`${server.url}.alab/id`);
    expect(internal.status).toBe(404);

    const traversal = await fetch(`${server.url}..%2f..%2fid`);
    expect([400, 404]).toContain(traversal.status);
  });
});
