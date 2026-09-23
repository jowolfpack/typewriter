/**
 * Turning a raw `.txt` file into something typeable.
 *
 * Real prose is full of characters a keyboard cannot produce -- curly quotes,
 * en dashes, non-breaking spaces -- and sitting at one of those with no way to
 * type it is the most infuriating bug a typing tutor can have. So the default
 * is to rewrite them into their typeable equivalents, and the toggle that turns
 * that off is for people who want the text exactly as written.
 */

/** Longest chunk handed to the typist at once, in characters. */
const MAX_CHUNK = 320;

/**
 * Characters that cannot be typed on a standard EN or DE layout, and what to
 * put in their place. Order matters only in that the space rules run last.
 */
const TYPOGRAPHY: ReadonlyArray<readonly [RegExp, string]> = [
  [/[“”„‟«»″]/g, '"'], // “ ” „ ‟ « » ″
  [/[‘’‚‛′]/g, "'"], // ‘ ’ ‚ ‛ ′
  [/[–—‒―]/g, "-"], // – — ‒ ―
  [/…/g, "..."], // …
  [/[      ]/g, " "], // nbsp and friends
  [/[​‌‍­]/g, ""], // zero-width and soft hyphens
];

/** Sentence enders, used to break an over-long paragraph somewhere sensible. */
const SENTENCE_END = /(?<=[.!?][)"']?)\s+/;

/**
 * Strip a byte-order mark and settle the encoding. Notepad still writes a BOM,
 * and `﻿` at the head of a file is an invisible first character nobody can
 * type. NFC matters for German: a decomposed "o + combining diaeresis" is two
 * code points, so it would need two keystrokes for one visible letter.
 */
export function clean(raw: string): string {
  return raw.replace(/^﻿/, "").normalize("NFC").replace(/\r\n?/g, "\n");
}

/** Rewrite typography into characters a keyboard actually has. */
export function normaliseTypography(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TYPOGRAPHY) out = out.replace(pattern, replacement);
  return out;
}

/**
 * A leading `# Title` line names the text; otherwise the filename does. That is
 * the whole file format, deliberately -- anything richer is a thing to maintain.
 */
export function extractTitle(text: string): { title: string | null; body: string } {
  const match = /^#\s+(.+?)\s*\n/.exec(text);
  if (match?.[1] === undefined) return { title: null, body: text };
  return { title: match[1], body: text.slice(match[0].length) };
}

/**
 * Split into typeable chunks: paragraphs first, then sentences, then words.
 * Paragraph breaks become chunk boundaries rather than characters, so you never
 * have to press Enter -- the line is one line, always.
 */
export function toChunks(body: string, max: number = MAX_CHUNK): string[] {
  const chunks: string[] = [];
  for (const paragraph of body.split(/\n\s*\n/)) {
    const flat = paragraph.replace(/\s+/g, " ").trim();
    if (flat === "") continue;
    for (const piece of splitLong(flat, max)) chunks.push(piece);
  }
  return chunks;
}

/** Greedily fill chunks from `parts`, never exceeding `max` unless a part is. */
function pack(parts: string[], max: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current === "") current = part;
    else if (current.length + 1 + part.length <= max) current = `${current} ${part}`;
    else {
      out.push(current);
      current = part;
    }
  }
  if (current !== "") out.push(current);
  return out;
}

function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = pack(text.split(SENTENCE_END), max);
  // A single sentence longer than a chunk still has to go somewhere: fall back
  // to word boundaries, which is the last place a break does not land mid-word.
  return sentences.flatMap((s) => (s.length <= max ? [s] : pack(s.split(/\s+/), max)));
}

/** Everything the library needs from one raw file. */
export function prepare(raw: string, normalise: boolean): { title: string | null; chunks: string[] } {
  const cleaned = normalise ? normaliseTypography(clean(raw)) : clean(raw);
  const { title, body } = extractTitle(cleaned);
  return { title, chunks: toChunks(body) };
}
