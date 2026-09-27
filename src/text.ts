/**
 * Turning a raw `.txt` file into something typeable, without rewriting it.
 *
 * An earlier version replaced curly quotes, dashes and ellipses with their
 * ASCII lookalikes so that every character was reachable on a keyboard. That is
 * the wrong trade: punctuation is part of the writing, and in verse it is part
 * of the art. The text is now shown exactly as written, and the tolerance moved
 * to the *input* side -- `typing.ts` accepts `"` where the text has `„`,
 * so an unreachable character never blocks you and never gets falsified either.
 *
 * Line breaks are kept for the same reason: a poem's lineation is the poem.
 */

/** Longest chunk handed to the typist at once, in characters. */
const MAX_CHUNK = 320;

/** Sentence enders, used to break an over-long paragraph somewhere sensible. */
const SENTENCE_END = /(?<=[.!?][)"'”’]?)\s+/;

/**
 * Invisible characters, which are the one thing that *must* go: a zero-width
 * space or a soft hyphen occupies a cell with no glyph and no key that produces
 * it, so it reads as the line refusing your keystroke for no reason.
 */
const INVISIBLE = /[\u200b\u200c\u200d\u200e\u200f\u00ad\ufeff]/g;

export interface PreparedText {
  readonly title: string | null;
  /** Ready to type. A chunk may contain `\n`, which is typed with Enter. */
  readonly chunks: string[];
  /** True when the file's line breaks look like hard wrapping, not lineation. */
  readonly wrapped: boolean;
  /** A poem: one chunk, the whole of it, stanza breaks typed as blank lines. */
  readonly verse: boolean;
}

/**
 * Settle the encoding. Notepad still writes a BOM, and `﻿` at the head of
 * a file is an invisible first character nobody can type. NFC matters for
 * German: a decomposed "o + combining diaeresis" is two code points, so it
 * would want two keystrokes for one visible letter.
 */
export function clean(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").normalize("NFC").replace(INVISIBLE, "");
}

/**
 * A leading `# Title` line names the text; otherwise the filename does. Under
 * it, a `Source: <url>` line says where the text was taken from, so a reader
 * can check a word against the edition instead of trusting this copy. That is
 * the whole file format, deliberately -- anything richer is a thing to maintain.
 */
export function extractHeader(text: string): {
  title: string | null;
  source: string | null;
  body: string;
} {
  let body = text;
  let title: string | null = null;
  let source: string | null = null;
  const heading = /^#\s+(.+?)\s*\n/.exec(body);
  if (heading?.[1] !== undefined) {
    title = heading[1];
    body = body.slice(heading[0].length);
  }
  // Only a web address: anything else on that line is the text itself.
  const link = /^Source:[ \t]*(https?:\/\/\S+)[ \t]*\n/i.exec(body);
  if (link?.[1] !== undefined) {
    source = link[1];
    body = body.slice(link[0].length);
  }
  return { title, source, body };
}

/** Blocks of consecutive lines, split on blank lines: paragraphs, or stanzas. */
function blocks(body: string): string[][] {
  return body
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        // Trailing spaces and runs of spaces are typing noise, not writing; a
        // line's leading indent is dropped for the same reason -- invisible and
        // unguessable.
        .map((cleanLine) => cleanLine.replace(/[ \t]+/g, " ").trim())
        .filter((cleanLine) => cleanLine !== ""),
    )
    .filter((block) => block.length > 0);
}

/**
 * Does this file wrap its prose at a margin, rather than mean its line breaks?
 *
 * Project Gutenberg wraps at about 70 characters, and honouring those breaks
 * would put an Enter in the middle of every sentence -- line breaks the author
 * never wrote. Verse lines are shorter and vary; wrapped lines crowd up against
 * the margin. The guess is never applied silently: the library says so and
 * offers the choice.
 */
export function looksWrapped(body: string): boolean {
  const inner: number[] = [];
  for (const block of blocks(body)) {
    // The last line of a paragraph stops early whatever the file does, so it
    // says nothing about wrapping.
    if (block.length >= 3) inner.push(...block.slice(0, -1).map((l) => l.length));
  }
  // Three sampled lines is the least that can show a margin at all.
  if (inner.length < 3) return false;
  const long = inner.filter((length) => length >= 50 && length <= 95).length;
  return long / inner.length >= 0.75;
}

/** Greedily fill chunks from `parts`, never exceeding `max` unless a part is. */
function pack(parts: string[], max: number, join: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current === "") current = part;
    else if (current.length + join.length + part.length <= max) current += join + part;
    else {
      out.push(current);
      current = part;
    }
  }
  if (current !== "") out.push(current);
  return out;
}

/** Split one over-long block: at line ends first, then sentences, then words. */
function splitBlock(lines: string[], max: number, join: string): string[] {
  const whole = lines.join(join);
  if (whole.length <= max) return [whole];
  // Verse: a break between lines is a break the writing already has.
  if (join === "\n") return pack(lines, max, "\n").flatMap((part) => splitProse(part, max));
  return splitProse(whole, max);
}

function splitProse(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const sentences = pack(text.split(SENTENCE_END), max, " ");
  // A single sentence longer than a chunk still has to go somewhere: word
  // boundaries are the last place a break does not land mid-word.
  return sentences.flatMap((s) => (s.length <= max ? [s] : pack(s.split(/\s+/), max, " ")));
}

/**
 * Split into typeable chunks. One block -- a paragraph or a stanza -- is one
 * chunk where it fits. `joinLines` rejoins hard-wrapped prose; left off, every
 * line break in the file is kept and typed.
 */
export function toChunks(body: string, joinLines: boolean, max: number = MAX_CHUNK): string[] {
  const join = joinLines ? " " : "\n";
  return blocks(body).flatMap((lines) => splitBlock(lines, max, join));
}

/**
 * Is this a poem? Most of its blocks are several lines long and the lines are
 * not wrapped at a margin. A prose file with one paragraph per line has
 * single-line blocks, so it never qualifies.
 */
export function looksLikeVerse(body: string): boolean {
  if (looksWrapped(body)) return false;
  const all = blocks(body);
  const multi = all.filter((lines) => lines.length >= 2).length;
  return all.length > 0 && multi / all.length >= 0.5;
}

/**
 * A poem as one piece. Cutting it at every stanza would stop you where the
 * poem does not stop, so the blank line between stanzas stays in the text and
 * is typed as a second Enter.
 */
function wholePoem(body: string): string {
  return blocks(body)
    .map((lines) => lines.join("\n"))
    .join("\n\n");
}

/** Everything the library needs from one raw file. */
export function prepare(raw: string, joinLines: boolean): PreparedText {
  const { title, body } = extractHeader(clean(raw));
  const verse = !joinLines && looksLikeVerse(body);
  const chunks = verse ? [wholePoem(body)] : toChunks(body, joinLines);
  return { title, chunks, wrapped: looksWrapped(body), verse };
}
