import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createProgram, createReviewCommand } from "../src/program.js";

const expectedCommands = ["start", "list", "remove", "cleanup"];
const root = resolve(import.meta.dirname, "..");

function runNode(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("review program surface", () => {
  it("exposes the v0 commands on the mountable review command", () => {
    const review = createReviewCommand();
    expect(review.name()).toBe("review");
    expect(review.commands.map((command) => command.name())).toEqual(expectedCommands);
  });

  it("mounts review under the alab dev root for the umbrella CLI", () => {
    const program = createProgram();
    expect(program.name()).toBe("alab");
    const review = program.commands.find((command) => command.name() === "review");
    expect(review?.commands.map((command) => command.name())).toEqual(expectedCommands);
  });

  it("imports the integration program without parsing or printing", () => {
    const result = runNode([
      "--input-type=module",
      "--eval",
      "await import('./src/program.ts')",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("routes alab review --help through the mounted subcommand", () => {
    const result = runNode([
      "--input-type=module",
      "--eval",
      "const { runReviewCli } = await import('./src/program.ts'); await runReviewCli(['node', 'alab', 'review', '--help']);",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("click-to-comment");
    expect(result.stdout).toContain("start");
  });
});
