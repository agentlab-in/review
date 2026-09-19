import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadReview, saveReview } from "./comments.js";

/** Best effort rematch after the user rewrites their HTML. Unmatched comments stay listed. */
export function rematchComments(targetDir: string): { matched: string[]; unmatched: string[] } {
  const dir = resolve(targetDir);
  const file = loadReview(dir);
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const comment of file.comments) {
    const pageFile = join(dir, comment.page.replace(/^\/+/, ""));
    let html: string | null = null;
    try {
      if (existsSync(pageFile)) html = readFileSync(pageFile, "utf8");
    } catch {
      html = null;
    }
    const ok = html !== null && scoreMatch(html, comment.selector, comment.tag, comment.textSnippet);
    comment.matched = ok;
    (ok ? matched : unmatched).push(comment.id);
  }

  saveReview(dir, file);
  return { matched, unmatched };
}

function scoreMatch(html: string, selector: string, tag: string, textSnippet: string): boolean {
  if (textSnippet && html.includes(textSnippet)) return true;

  let selectorHit = false;
  const idMatch = selector.match(/#([A-Za-z][\w:.-]*)/);
  if (idMatch && html.includes(`id="${idMatch[1]}"`)) selectorHit = true;
  const classMatch = selector.match(/\.([A-Za-z][\w-]*)/);
  if (!selectorHit && classMatch && html.includes(classMatch[1])) selectorHit = true;
  if (!selectorHit && !idMatch && !classMatch && selector.trim() !== "") {
    selectorHit = true;
  }
  if (!selectorHit) return false;

  if (!tag) return true;
  return html.toLowerCase().includes(`<${tag.toLowerCase()}`);
}
