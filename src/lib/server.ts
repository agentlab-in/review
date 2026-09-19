import { createServer, type IncomingMessage, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { addComment, listComments, removeComments } from "./comments.js";
import { injectOverlay, OVERLAY_MARKER } from "./overlay.js";
import { ensureProject } from "./project.js";
import { rematchComments } from "./rematch.js";

export interface ReviewServer {
  dir: string;
  projectId: string;
  port: number;
  url: string;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const BODY_LIMIT = 1024 * 1024;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Request body is not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

/** Resolve a URL path to a file under dir. Returns null when blocked or missing. */
export function resolveServedPath(dir: string, urlPath: string): string | null {
  const root = resolve(dir);
  let pathname = urlPath.split("?")[0] ?? "/";
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  const rel = normalize(pathname).replace(/^[/\\]+/, "");
  const abs = resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  const relLower = rel.toLowerCase();
  if (relLower === ".alab" || relLower.startsWith(`.alab${sep}`) || relLower.startsWith(".alab/")) return null;
  return abs;
}

function contentType(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Start a foreground local HTTP server for the folder. Serves files as is,
 * except HTML which gets the comment overlay injected in memory. The folder
 * on disk is never rewritten. Resolves once listening.
 */
export async function startReviewServer(options: { dir: string; port?: number }): Promise<ReviewServer> {
  const { dir, projectId } = ensureProject(options.dir);
  rematchComments(dir);

  const server: Server = createServer(async (req, res) => {
    try {
      const method = (req.method ?? "GET").toUpperCase();
      const urlPath = (req.url ?? "/").split("?")[0] ?? "/";

      if (urlPath === "/__alab/comments" && method === "GET") {
        const comments = listComments(dir);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ projectId, comments }));
        return;
      }

      if (urlPath === "/__alab/comments" && method === "POST") {
        const raw = (await readJsonBody(req)) as Record<string, unknown>;
        const comment = addComment(dir, {
          page: typeof raw.page === "string" ? raw.page : "/",
          selector: typeof raw.selector === "string" ? raw.selector : "",
          tag: typeof raw.tag === "string" ? raw.tag : "",
          textSnippet: typeof raw.textSnippet === "string" ? raw.textSnippet : "",
          body: typeof raw.body === "string" ? raw.body : "",
        });
        res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(comment));
        return;
      }

      if (urlPath === "/__alab/comments" && method === "DELETE") {
        const target = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("target") ?? "all";
        const result = removeComments(dir, target);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ projectId, ...result }));
        return;
      }

      if (urlPath === "/__alab/project" && method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ projectId }));
        return;
      }

      if (method !== "GET" && method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Method not allowed.");
        return;
      }

      let filePath = resolveServedPath(dir, urlPath === "/" ? "/index.html" : urlPath);
      if (filePath && existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = resolveServedPath(dir, `${urlPath.replace(/\/?$/, "/")}index.html`);
      }
      if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found.");
        return;
      }

      const type = contentType(filePath);
      if (type.startsWith("text/html")) {
        const html = readFileSync(filePath, "utf8");
        const served = injectOverlay(html, projectId, listComments(dir).length);
        res.writeHead(200, { "Content-Type": type, "Content-Length": Buffer.byteLength(served) });
        if (method === "GET") res.end(served);
        else res.end();
        return;
      }

      const bytes = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length });
      if (method === "GET") res.end(bytes);
      else res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not valid JSON|must not be empty|Invalid comment target|Unknown comment/i.test(message) ? 400 : 500;
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: message }));
    }
  });

  const port = options.port ?? 0;
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolveListen();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    dir,
    projectId,
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}/`,
    close: () => new Promise<void>((resolveClose, rejectClose) => server.close((e) => (e ? rejectClose(e) : resolveClose()))),
  };
}

export { OVERLAY_MARKER };
