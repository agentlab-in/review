# AgentLab Review

This repository contains `@agentlab/review`, a local click-to-comment review
server for folders of static HTML. It is a product library, not a public
binary: there is no `bin` field, no `alab` bin, and no `agentlab-review` bin.
A future `alab-cli` wires it as `alab review ...` through `src/program.ts`.

These instructions apply only inside this repository. Follow the workspace-level
instructions in the parent directory as well.

## Product boundaries

- Reviews a directory only, never a single file. A file path is rejected with
  a clear error.
- Foreground local HTTP server on 127.0.0.1. Prints the project id and URL,
  then blocks until SIGINT or SIGTERM.
- Serves the folder as is. HTML gets the comment overlay injected in memory.
  User HTML on disk is never rewritten.
- Local only. No Cloudflare, no Pages deploy, no auth, no network beyond
  loopback.
- This repo never publishes, deploys, or phones home. Keep it that way.

## Runtime and tooling

- Node.js 20 or newer is required.
- Use `pnpm` for dependency installation and repository scripts.
- The package is ESM and TypeScript uses `NodeNext` module resolution.
- Source imports include `.js` extensions intentionally so compiled ESM works.
  Preserve that convention in TypeScript files.
- One runtime dependency: `commander`. Prefer Node.js standard modules for
  everything else.

Useful commands:

```bash
pnpm install
pnpm build
pnpm test
```

There is no bin to link. Run the server in development with tsx, for example:

```bash
./node_modules/.bin/tsx --eval "import('./src/program.ts').then(async (m) => { await m.runReviewCli(['node', 'review', 'start', './fixtures/site', '--port', '4210']); })"
```

## Architecture

The execution path is intentionally shallow:

```text
src/program.ts (side-effect free: createReviewCommand mount for alab-cli)
  -> src/commands/{start,list,remove,cleanup}.ts
  -> src/lib/{project,index-store,comments,rematch,overlay,server,target}.ts
  -> <reviewed-dir>/.alab/ (id file + review.json) and ~/.alab/review-index.json
```

Key responsibilities:

- `src/program.ts` exports `createReviewCommand`, the mountable `review`
  command the `alab` binary attaches with `addCommand`, plus `createProgram`
  (the dev root named `alab` with `review` mounted) and `runReviewCli` for
  development and tests. It runs nothing on import. Both the mountable
  command and the dev root use `exitOverride`, so errors throw instead of
  exiting and the hosting binary owns exit codes.
- `src/index.ts` is the public library entry. It re-exports the program
  factory, the commands, and the store, server, and rematch functions.
- `src/commands/start.ts` starts the foreground server, prints the project
  id and URL, and waits for SIGINT or SIGTERM before closing.
- `src/commands/list.ts` prints comments from `.alab/review.json`.
  `--rematch` refreshes matched flags first.
- `src/commands/remove.ts` handles `--remove-comments <cN|all>`, the
  `--clean` alias for all, and `--cleanup` for deleting `.alab/`.
- `src/commands/cleanup.ts` deletes `<dir>/.alab/` and forgets the id to
  folder mapping.
- `src/lib/project.ts` owns `<dir>/.alab/` (id file plus review.json) and
  8-char lowercase alphanumeric project ids.
- `src/lib/index-store.ts` owns the local id to folder map used by
  `--project <id>` resume. It defaults to `~/.alab/review-index.json` and
  honors `ALAB_HOME`.
- `src/lib/comments.ts` owns comment ids (sequential c1, c2, ... with a
  counter that never moves backwards), listing, removal, and cleanup.
- `src/lib/rematch.ts` best effort rematches comments after an HTML
  rewrite using selector, tag, and text snippet. Unmatched comments stay
  in the file and the list with `matched: false`. Nothing is dropped.
- `src/lib/overlay.ts` builds the injected click-to-comment snippet.
- `src/lib/server.ts` serves the folder, injects the overlay into HTML in
  memory only, and exposes the `/__alab/comments` API. It refuses to serve
  `.alab/` internals and blocks path traversal.
- `src/lib/target.ts` resolves `--dir` versus `--project`. Passing both is
  an error.

## State and side effects

There are two state boundaries. Keep them explicit in code and tests.

### Reviewed directory state

- `<dir>/.alab/id` holds the 8-char project id.
- `<dir>/.alab/review.json` holds `{ projectId, version, counter, comments }`.
- The counter only increases, so comment ids are never reused in a project.
- `--remove-comments all` and `--clean` clear comments but keep the id and
  the counter. `cleanup` and `remove --cleanup` delete `.alab/` entirely.
- Tests must use temporary site folders, never a real user folder.

### Local user state

- `~/.alab/review-index.json` maps project ids to folders for `--project`
  resume. `ALAB_HOME` overrides the home directory.
- Tests must isolate this state with temporary directories and set
  `ALAB_HOME`. They must restore the variable and remove the temporary
  directory during cleanup.
- Never inspect, print, overwrite, or commit a real index file or unrelated
  review state from the user's home.

## Command semantics

| Command | `.alab/` in target dir | Index | Disk HTML | Network |
| --- | --- | --- | --- | --- |
| `start` | Creates if missing, rematches | Registers id to dir | Never rewritten | Serves on 127.0.0.1 until SIGINT |
| `list` | Reads | No change | No change | No |
| `remove --remove-comments cN` | Removes one comment, counter kept | No change | No change | No |
| `remove --remove-comments all` / `--clean` | Clears comments, id and counter kept | No change | No change | No |
| `remove --cleanup` / `cleanup` | Deletes `.alab/` | Unregisters id | No change | No |

## Tests and verification

Tests use Vitest and live under `tests/`. Match a behavior change to the
narrowest relevant suite:

- `project.test.ts`: id format, `.alab/` layout, stable ids, file rejection.
- `comments.test.ts`: sequential ids, no reuse, single and bulk removal.
- `cleanup.test.ts`: remove-all keeps state, cleanup deletes and unregisters.
- `rematch.test.ts`: unmatched comments persist after an HTML rewrite.
- `server.test.ts`: overlay injection, disk unchanged, comment API round
  trip, `.alab/` and traversal blocking.
- `program.test.ts`: command surface, `alab review` mounting, and the
  side-effect free `src/program.ts` integration entry point.

For normal code changes, run both:

```bash
pnpm test
pnpm build
```

Report exactly what ran, passed, failed, or was skipped. Add regression
tests for changed command behavior, state transitions, served HTML, JSON
output, or rematch rules. Tests must not depend on the real home directory,
the network beyond loopback, or global tools.

## Change discipline

- Keep command orchestration in `src/commands` and reusable rules in
  `src/lib`.
- Preserve the simple synchronous filesystem model unless a concrete
  requirement justifies changing it.
- Avoid adding frameworks or runtime dependencies for behavior available
  from Node.js standard modules.
- Keep user-facing help, README examples, command behavior, and tests
  aligned.
- Do not add a `bin` field or a self-executing CLI entry. The umbrella
  `alab-cli` owns the binary; this repo is the library.
- Do not deploy, publish the package, or push unless the task explicitly
  authorizes that action.
- Do not commit unless explicitly requested.

## Definition of done

A change is complete when:

1. The requested behavior is implemented within this repository's product scope.
2. Local-only exposure and reviewed-dir versus home side effects were reviewed.
3. Ids, paths, served HTML, and JSON output remain safe.
4. Relevant regression tests were added or updated.
5. `pnpm test` passes.
6. `pnpm build` passes for source changes.
7. README and CLI help are updated when the user-visible contract changed.
8. No deploy, publish, push, secret exposure, or unrelated file change
   occurred without explicit authorization.
9. The handoff states the files changed and the exact verification results.
