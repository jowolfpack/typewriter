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
 * A leading `# Title` line names the text; otherwise the filename does. That is
 * the whole file format, deliberately -- anything richer is a thing to maintain.
 */
export function extractTitle(text: string): { title: string | null; body: string } {
  const match = /^#\s+(.+?)\s*\n/.exec(text);
  if (match?.[1] === undefined) return { title: null, body: text };
  return { title: match[1], body: text.slice(match[0].length) };
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

/** Everything the library needs from one raw file. */
export function prepare(raw: string, joinLines: boolean): PreparedText {
  const { title, body } = extractTitle(clean(raw));
  return { title, chunks: toChunks(body, joinLines), wrapped: looksWrapped(body) };
}
