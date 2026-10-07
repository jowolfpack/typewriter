/**
 * The typing state machine: pure, DOM-free, and the part worth testing.
 *
 * State is deliberately only two things -- the target and what was actually
 * pressed. Everything the renderer and the statistics need is derived from
 * those, which is what makes "backspace anywhere" fall out for free instead of
 * needing a second code path.
 */

/**
 * Characters the text may contain that a standard EN or DE keyboard cannot
 * produce, and the key that may stand in for each.
 *
 * The text keeps its real punctuation -- it is part of the writing, and in
 * verse part of the art -- so the tolerance lives here instead: press `"` where
 * the page shows `„` and it counts, while the line still shows `„`.
 * One keystroke per position; an ellipsis is one cell and one press. The one
 * exception is `ß` typed as `ss` (see `opens()`), which takes two.
 */
const STAND_INS: Readonly<Record<string, string>> = {
  "“": '"', // “
  "”": '"', // ”
  "„": '"', // „
  "‟": '"', // ‟
  "«": '"', // «
  "»": '"', // »
  "″": '"', // ″
  "‘": "'", // ‘
  "’": "'", // ’
  "‚": "'", // ‚
  "‛": "'", // ‛
  "′": "'", // ′
  "‹": "'", // ‹
  "›": "'", // ›
  "–": "-", // –
  "—": "-", // —
  "‒": "-", // ‒
  "―": "-", // ―
  "…": ".", // …
  " ": " ", // no-break space
  " ": " ", // narrow no-break space
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
};

/**
 * Is this keystroke right for this position? Exact first, then the stand-in.
 * The only place correctness is decided.
 */
export function matches(expected: string, typed: string): boolean {
  return expected === typed || STAND_INS[expected] === typed;
}

/**
 * The key a reader actually presses for this character. The statistics count
 * that rather than the character on the page: pressing `"` for `„` is work
 * done by the right little finger, and a weak-key list that blamed `„` --
 * a key no German keyboard has -- would be advice nobody can act on.
 */
export function keyFor(expected: string): string {
  return STAND_INS[expected] ?? expected;
}

/**
 * Punctuation a by-heart session lets you leave out. Spaces and line breaks are
 * not in it: a space is where one word ends, and where a line ends is part of
 * knowing a poem.
 */
const OPTIONAL = /\p{P}/u;

/** Could this position be filled in for you, if it sits in a run with punctuation? */
function skippable(ch: string): boolean {
  return OPTIONAL.test(ch) || ch === " ";
}

/**
 * Is `ch` a correct start for this position? A `ß` may be typed as `ss` -- the
 * old and the new spelling rules disagree about it, and an English keyboard has
 * no `ß` at all -- so a lone `s` is a beginning there, not yet a mistake.
 */
function opens(expected: string, ch: string): boolean {
  return matches(expected, ch) || (expected === "ß" && ch === "s");
}

/** A position the last keystroke settled, for the statistics. */
export interface Judged {
  readonly index: number;
  /** The key that was pressed for it -- `s` for a `ß` typed as `ss`. */
  readonly key: string;
  readonly correct: boolean;
}

/**
 * How a single position should be drawn. `skipped` is punctuation filled in
 * because the next letter was typed; `hinted` is a position not yet typed that
 * a hint revealed.
 */
export type CellState = "done" | "wrong" | "pending" | "skipped" | "hinted";

export interface SessionOptions {
  /**
   * By heart: punctuation may be left out. Typing the letter after a mark (or
   * after a mark and its space, as in `Gesicht? —`) fills the mark in. Only
   * while nothing is wrong -- in a red run there is nothing to line up with.
   */
  readonly optionalPunctuation?: boolean;
}

/** One position of the line: what was wanted, what was typed, how to paint it. */
export interface Cell {
  readonly expected: string;
  /** What the user actually pressed here, or `null` if they have not got here yet. */
  readonly typed: string | null;
  readonly state: CellState;
}

export class TypingSession {
  private readonly chars: readonly string[];
  private readonly pressed: string[] = [];
  /**
   * Lowest index where what was pressed differs from the target, or -1.
   * Kept as a field rather than rescanned: it is read on every keystroke to
   * paint the line, and a scan would be O(n) per character on a long chunk.
   */
  private error = -1;
  private readonly optional: boolean;
  /** Positions filled in rather than typed. Never keystrokes, never judged. */
  private readonly filled = new Set<number>();
  /** Positions a hint has revealed; they stay revealed for the rest of the part. */
  private readonly hinted = new Set<number>();
  /** A `ß` whose first `s` is in, waiting for the second; -1 otherwise. */
  private half = -1;
  private settled: Judged[] = [];

  constructor(target: string, options: SessionOptions = {}) {
    // Split by code point, not by UTF-16 unit, so one press is always one cell.
    this.chars = Array.from(target);
    this.optional = options.optionalPunctuation ?? false;
  }

  /** The text being typed, as it was handed in. */
  get target(): string {
    return this.chars.join("");
  }

  /** Number of positions in the target. */
  get length(): number {
    return this.chars.length;
  }

  /** Index of the next position to be typed; also the number typed so far. */
  get cursor(): number {
    return this.pressed.length;
  }

  /** Lowest position that does not match, or -1 when everything so far is right. */
  get firstError(): number {
    return this.error;
  }

  /**
   * The positions the last keystroke settled. Usually one; none for the first
   * `s` of a `ß`, two when that `s` turns out not to be followed by another.
   * By heart a press can also land past skipped punctuation, so the statistics
   * read positions from here rather than from the cursor.
   */
  get judged(): readonly Judged[] {
    return this.settled;
  }

  /** True while any typed position is wrong -- the whole tail then reads red. */
  get isError(): boolean {
    return this.error !== -1;
  }

  /** Finished only when every position was typed and nothing is left wrong. */
  get done(): boolean {
    return this.pressed.length === this.chars.length && this.error === -1 && this.half === -1;
  }

  /**
   * Record a keypress. Returns whether it matched, so the caller can tally it
   * without re-deriving the answer.
   *
   * Input past the end of the target is ignored: that bounds the buffer, and
   * an unfixed mistake already blocks completion without needing to overrun.
   */
  type(ch: string): boolean {
    this.settled = [];
    if (this.pressed.length >= this.chars.length) return false;
    if (this.half !== -1) {
      const index = this.half;
      this.half = -1;
      if (ch === "s") {
        this.commit(index, "ss", true);
        this.settleEnd();
        return true;
      }
      // One `s` is not a `ß`; it stands as typed, and `ch` goes on after it.
      this.commit(index, "s", false);
      if (this.pressed.length >= this.chars.length) return false;
    }
    if (this.optional && this.error === -1) this.fill(this.skipTo(ch));
    const index = this.pressed.length;
    const expected = this.chars[index] ?? "";
    // In a red run nothing lines up anyway, so an `s` there is just an `s`.
    if (expected === "ß" && ch === "s" && this.error === -1) {
      this.half = index;
      return true;
    }
    const correct = matches(expected, ch);
    this.commit(index, ch, correct);
    this.settleEnd();
    return correct;
  }

  private commit(index: number, typed: string, correct: boolean): void {
    this.pressed.push(typed);
    const expected = this.chars[index] ?? "";
    const key = expected === "ß" && typed.startsWith("s") ? "s" : keyFor(expected);
    this.settled.push({ index, key, correct });
    if (!correct && this.error === -1) this.error = index;
  }

  /** Punctuation after the last word has no letter to follow it. */
  private settleEnd(): void {
    if (this.optional && this.error === -1 && this.rest().every(skippable)) {
      this.fill(this.chars.length);
    }
  }

  /**
   * Where `ch` lands if the punctuation ahead of the cursor is left out: the
   * first position it matches across a run of punctuation and spaces that
   * holds at least one mark. The cursor itself when nothing is skipped -- a
   * bare space is never skipped, since it is the edge of a word.
   */
  private skipTo(ch: string): number {
    const start = this.pressed.length;
    if (opens(this.chars[start] ?? "", ch)) return start;
    let marks = false;
    for (let j = start; j < this.chars.length; j += 1) {
      const here = this.chars[j] ?? "";
      if (j > start && marks && opens(here, ch)) return j;
      if (!skippable(here)) break;
      if (here !== " ") marks = true;
    }
    return start;
  }

  /** Fill every position up to `end` with what the text has there. */
  private fill(end: number): void {
    while (this.pressed.length < end) {
      this.filled.add(this.pressed.length);
      this.pressed.push(this.chars[this.pressed.length] ?? "");
    }
  }

  private rest(): string[] {
    return this.chars.slice(this.pressed.length);
  }

  /**
   * Delete one position. This may run back through *correct* text and all the
   * way to the start -- nothing is locked in once typed.
   */
  backspace(): boolean {
    if (this.half !== -1) {
      this.half = -1;
      this.dropFilled();
      return true;
    }
    if (this.pressed.length === 0) return false;
    const last = this.pressed.length - 1;
    // `ss` is two keystrokes, so it comes off one `s` at a time.
    if (this.pressed[last] === "ss") {
      this.pop();
      this.half = last;
      return true;
    }
    this.pop();
    this.dropFilled();
    return true;
  }

  private dropFilled(): void {
    // Filled-in punctuation goes with the letter that brought it in, so the
    // marks are open to type again rather than one more thing to delete.
    while (this.filled.has(this.pressed.length - 1)) this.pop();
  }

  private pop(): void {
    this.pressed.pop();
    this.filled.delete(this.pressed.length);
    // Only the first mismatch is tracked, so removing it is the only way the
    // error can clear -- anything earlier than it matched by definition.
    if (this.error === this.pressed.length) this.error = -1;
  }

  /**
   * Reveal the next word: from the cursor -- or from the mistake, while there
   * is one -- through to the space or line break after it. A line break on its
   * own is a word here, since where the line ends is what you forgot. Returns
   * the newly revealed positions that count as not known; punctuation that
   * could have been left out is revealed for free.
   */
  hint(): number[] {
    const start = this.error === -1 ? this.pressed.length : this.error;
    let end = start;
    if (this.chars[end] === "\n") end += 1;
    else {
      while (this.chars[end] === " ") end += 1;
      while (end < this.chars.length && this.chars[end] !== " " && this.chars[end] !== "\n") {
        end += 1;
      }
    }
    const counted: number[] = [];
    for (let i = start; i < end; i += 1) {
      if (this.hinted.has(i)) continue;
      this.hinted.add(i);
      if (!(this.optional && OPTIONAL.test(this.chars[i] ?? ""))) counted.push(i);
    }
    return counted;
  }

  /** Ctrl+Backspace: delete trailing spaces, then the word before them. */
  backspaceWord(): boolean {
    if (this.pressed.length === 0) return false;
    while (this.pressed.length > 0 && this.pressed[this.pressed.length - 1] === " ") {
      this.backspace();
    }
    while (this.pressed.length > 0 && this.pressed[this.pressed.length - 1] !== " ") {
      this.backspace();
    }
    return true;
  }

  /** The expected character at a position, or "" past the end. */
  expectedAt(index: number): string {
    return this.chars[index] ?? "";
  }

  /**
   * How to draw one position. Everything from `firstError` up to the cursor is
   * wrong, not just the mismatched character itself: that is the rule the whole
   * app is built on -- one bad letter reddens the rest until it is deleted.
   */
  cellAt(index: number): Cell {
    const expected = this.chars[index] ?? "";
    // Half a `ß`: drawn as typed so far, since the `s` did land.
    if (index === this.half) return { expected, typed: "s", state: "done" };
    if (index >= this.pressed.length) {
      return { expected, typed: null, state: this.hinted.has(index) ? "hinted" : "pending" };
    }
    const typed = this.pressed[index] ?? "";
    const wrong = this.error !== -1 && index >= this.error;
    return {
      expected,
      typed,
      state: wrong ? "wrong" : this.filled.has(index) ? "skipped" : "done",
    };
  }
}
