import { Command } from "commander";
import { cleanupCommand } from "./commands/cleanup.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { startCommand } from "./commands/start.js";

export const REVIEW_VERSION = "0.1.0";

const HELP_TEXT = [
  "",
  "Agent flow:",
  "  Write HTML, run `review start ./site`, collect human comments,",
  "  then read .alab/review.json and edit the HTML. Unmatched comments",
  "  stay listed after a rewrite; nothing is dropped silently.",
  "",
  "Local only. No deploy, no auth, no network beyond 127.0.0.1.",
  "",
].join("\n");

function addReviewCommands(cmd: Command): void {
  cmd
    .command("start")
    .description("Serve a folder with the click-to-comment overlay (blocks until Ctrl+C)")
    .argument("[dir]", "directory to review", undefined)
    .option("-p, --port <number>", "port to listen on (default: ephemeral)", (value) => {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid port "${value}". Use 0-65535.`);
      }
      return port;
    })
    .option("--project <id>", "resume a known project by id instead of passing a directory")
    .option("--json", "machine readable output", false)
    .action(
      async (
        dir: string | undefined,
        opts: { port?: number; project?: string; json?: boolean },
      ) => startCommand({ dir, ...opts }),
    );

  cmd
    .command("list")
    .description("List comments stored in .alab/review.json")
    .option("--dir <path>", "reviewed directory (default: current directory)")
    .option("--project <id>", "resume a known project by id")
    .option("--rematch", "refresh matched flags against current HTML first", false)
    .option("--json", "machine readable output", false)
    .action((opts: { dir?: string; project?: string; rematch?: boolean; json?: boolean }) =>
      listCommand(opts),
    );

  cmd
    .command("remove")
    .description("Remove comments, or delete review state")
    .option("--dir <path>", "reviewed directory (default: current directory)")
    .option("--project <id>", "resume a known project by id")
    .option("--remove-comments <target>", "comment id like c1, or all")
    .option("--clean", "alias for --remove-comments all", false)
    .option("--cleanup", "delete .alab/ entirely", false)
    .option("--json", "machine readable output", false)
    .action(
      (opts: {
        dir?: string;
        project?: string;
        removeComments?: string;
        clean?: boolean;
        cleanup?: boolean;
        json?: boolean;
      }) => removeCommand(opts),
    );

  cmd
    .command("cleanup")
    .description("Delete <dir>/.alab/ entirely and forget the project mapping")
    .option("--dir <path>", "reviewed directory (default: current directory)")
    .option("--project <id>", "resume a known project by id")
    .option("--json", "machine readable output", false)
    .action((opts: { dir?: string; project?: string; json?: boolean }) => cleanupCommand(opts));
}

/**
 * Side-effect free program factory for the future `alab review` wiring.
 * Importing this module parses nothing and prints nothing. The umbrella CLI
 * should call `runReviewCli(argv)` with the original process.argv, the same
 * way it calls the Pages `runCli`.
 */
export function createProgram(options?: { legacyAlab?: boolean }): Command {
  if (options?.legacyAlab) {
    const program = new Command();
    program.exitOverride();
    program.name("alab").description("agentlab CLI");
    const review = program.command("review").description("Local click-to-comment review server");
    addReviewCommands(review);
    return program;
  }
  const program = new Command();
  program.exitOverride();
  program
    .name("review")
    .description("Local click-to-comment review server for static HTML folders")
    .version(REVIEW_VERSION)
    .addHelpText("after", HELP_TEXT);
  addReviewCommands(program);
  return program;
}

/** Run the review CLI with the given argv. Used by `alab review ...` later. */
export async function runReviewCli(argv = process.argv): Promise<void> {
  const program = createProgram({ legacyAlab: argv[2] === "review" });
  try {
    await program.parseAsync(argv);
  } catch (err) {
    const e = err as { code?: string };
    if (e?.code === "commander.helpDisplayed" || e?.code === "commander.version") return;
    throw err;
  }
}
