import { resolve } from "node:path";
import { resolveProjectDir } from "../lib/index-store.js";
import { startReviewServer } from "../lib/server.js";

function waitForSignal(): Promise<void> {
  return new Promise((resolveSignal) => {
    const stop = () => resolveSignal();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

export interface StartOptions {
  dir?: string;
  port?: number;
  project?: string;
  json?: boolean;
}

/** Start the foreground review server and block until SIGINT or SIGTERM. */
export async function startCommand(options: StartOptions): Promise<void> {
  if (options.project && options.dir) {
    throw new Error("Pass either a directory or --project <id>, not both.");
  }
  const dir = options.project ? resolveProjectDir(options.project) : resolve(options.dir ?? ".");
  const server = await startReviewServer({ dir, port: options.port });

  if (options.json) {
    console.log(JSON.stringify({ projectId: server.projectId, url: server.url, dir: server.dir }));
  } else {
    console.log(`project ${server.projectId}`);
    console.log(server.url);
    console.log(`Reviewing ${server.dir}. Press Ctrl+C to stop.`);
  }

  await waitForSignal();
  await server.close();
}
