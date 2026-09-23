/**
 * The text library: what there is to type, and where it came from.
 *
 * `import.meta.glob` is the one place this app departs from StateLearner's
 * "static imports only" rule, and it is the whole point of the feature: a .txt
 * dropped into `texts/` has to appear with no registry to edit and no generator
 * to run. Vite resolves these at build time, so the published site is still a
 * plain static bundle with the texts baked in.
 */

import type { Lang } from "./layouts";
import type { ImportedText } from "./storage";
import { clean, extractTitle } from "./text";

/** Where a text came from, which decides whether the world can see it. */
export type Source = "repo" | "local" | "imported";

export interface TextEntry {
  /** Stable across reloads: the path, or `imported:<name>`. Keys the saved position. */
  readonly id: string;
  readonly title: string;
  readonly lang: Lang;
  readonly source: Source;
  readonly raw: string;
  /** True when the file did not arrive as readable UTF-8 text. */
  readonly broken: boolean;
}

const REPO = import.meta.glob("/texts/**/*.txt", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const LOCAL = import.meta.glob("/texts-local/**/*.txt", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/**
 * A NUL or a replacement character means the file was not UTF-8 -- almost
 * always Notepad writing UTF-16. Listing it anyway would offer the user a text
 * made of mojibake and no explanation.
 */
export function looksBinary(raw: string): boolean {
  return /[\u0000�]/.test(raw);
}

/** `die-verwandlung.txt` -> `Die Verwandlung`, the fallback when there is no heading. */
export function titleFromPath(path: string): string {
  const base = (path.split("/").pop() ?? path).replace(/\.txt$/i, "");
  return base
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** The folder names the language, so there is no metadata to keep in step. */
export function langFromPath(path: string): Lang | null {
  const parts = path.split("/").filter((part) => part !== "");
  const folder = parts[1];
  if (folder === "en" || folder === "de") return folder;
  return null;
}

/** Build one entry, or null for a file outside an `en/` or `de/` folder. */
export function entryFromPath(path: string, raw: string, source: Source): TextEntry | null {
  const lang = langFromPath(path);
  if (lang === null) return null;
  const broken = looksBinary(raw);
  const heading = broken ? null : extractTitle(clean(raw)).title;
  return { id: path, title: heading ?? titleFromPath(path), lang, source, raw, broken };
}

/** An entry for a text the user dropped into the browser instead of the repo. */
export function entryFromImport(text: ImportedText): TextEntry {
  return {
    id: text.id,
    title: text.title,
    lang: text.lang,
    source: "imported",
    raw: text.raw,
    broken: looksBinary(text.raw),
  };
}

/** Everything bundled at build time, repo texts first, then local-only ones. */
export function bundledTexts(): TextEntry[] {
  const entries: TextEntry[] = [];
  for (const [path, raw] of Object.entries(REPO)) {
    const entry = entryFromPath(path, raw, "repo");
    if (entry !== null) entries.push(entry);
  }
  for (const [path, raw] of Object.entries(LOCAL)) {
    const entry = entryFromPath(path, raw, "local");
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

/** The whole library for one language, sorted by title. */
export function libraryFor(lang: Lang, imported: readonly ImportedText[]): TextEntry[] {
  return [...bundledTexts(), ...imported.map(entryFromImport)]
    .filter((entry) => entry.lang === lang)
    .sort((a, b) => a.title.localeCompare(b.title));
}
