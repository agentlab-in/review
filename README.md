# AgentLab Review

Local click-to-comment review server for folders of static HTML. This is the
product library behind the future `alab review ...` command. It ships no
binary: no `bin.alab`, no `agentlab-review` bin. The umbrella `alab-cli`
wires it through `src/program.ts`.

Agent flow: the agent writes HTML, starts the review server, the human clicks
to comment, and the agent reads `.alab/review.json` and edits the HTML.

```bash
pnpm install
pnpm build
pnpm test
```

Serve the fixture site in development (foreground, blocks until Ctrl+C):

```bash
./node_modules/.bin/tsx --eval "import('./src/program.ts').then(async (m) => { await m.runReviewCli(['node', 'review', 'start', './fixtures/site', '--port', '4210']); })"
```

Then open `http://127.0.0.1:4210/`, toggle comment mode in the corner badge,
and click any element to leave a comment.

## Commands

```text
review start [dir] [--port <number>] [--project <id>] [--json]
review list [--dir <path>] [--project <id>] [--rematch] [--json]
review remove [--dir <path>] [--project <id>] --remove-comments <cN|all> [--clean] [--cleanup] [--json]
review cleanup [--dir <path>] [--project <id>] [--json]
```

- `start` takes a directory only, never a single file. It prints the project
  id and URL, serves on 127.0.0.1, and blocks until SIGINT or SIGTERM.
- `list` prints comments from `.alab/review.json`. `--rematch` refreshes the
  matched flags against the current HTML first.
- `remove --remove-comments c1` removes one comment. `--remove-comments all`
  and `--clean` clear comments but keep the project id and the counter, so
  ids are never reused.
- `remove --cleanup` and `cleanup` delete `<dir>/.alab/` entirely and forget
  the project mapping.
- `--project <id>` resumes a known folder through the local id to folder
  map. `--dir` and `--project` together are an error.

## Review state

| Item | Behavior |
| --- | --- |
| Project id | 8 lowercase letters or digits, stored in `<dir>/.alab/id` |
| Comments | `<dir>/.alab/review.json` with `{ projectId, counter, comments }` |
| Comment ids | Sequential c1, c2, ...; the counter never moves backwards |
| Id to folder map | `~/.alab/review-index.json` (`ALAB_HOME` overrides home) |
| Served HTML | Overlay injected in memory only; disk files never change |
| Rematch | Selector plus tag plus text snippet; unmatched comments stay listed |

## Library and alab-cli wiring

Programmatic use:

```ts
import { ensureProject, listComments, startReviewServer } from "@agentlab/review";

const { projectId } = ensureProject("./site");
const server = await startReviewServer({ dir: "./site", port: 4210 });
console.log(server.url);
```

Umbrella wiring (same contract as Pages): the router imports
`runReviewCli(argv)` from `@agentlab/review/program` and calls it in process
with the original `process.argv` when the first tool argument is `review`.
Importing `src/program.ts` parses nothing and prints nothing.

## Development

```bash
pnpm test
pnpm build
```

Tests isolate `ALAB_HOME` with temporary directories. Routine verification
must not touch real user state. This package is local only: no deploy, no
auth, no Cloudflare.
