import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { sourceOrder } from "@/content/data";

import type { Source } from "./types";

const SOURCES_DIR = path.join(process.cwd(), "content", "sources");

// Same files the backend seeds into retrieval (apps.portfolio.corpus); the parse
// rules must stay identical on both sides.
export function loadSources(): Source[] {
  return readdirSync(SOURCES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => parseSource(file.replace(/\.md$/, ""), readFileSync(path.join(SOURCES_DIR, file), "utf8")));
}

export function parseSource(id: string, raw: string): Source {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n+([\s\S]*)$/);
  if (!match) throw new Error(`content/sources/${id}.md has no front matter`);
  const meta = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  return { id, doc: meta.doc, title: meta.title, text: match[2].trim() };
}

/** Résumé reading order: the source viewer pages through a document in this order. */
export function orderSources(sources: Source[]): Source[] {
  const rank = (id: string) => {
    const i = (sourceOrder as readonly string[]).indexOf(id);
    return i < 0 ? sourceOrder.length : i;
  };
  return [...sources].sort((a, b) => rank(a.id) - rank(b.id));
}
