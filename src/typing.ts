/**
 * The typing state machine: pure, DOM-free, and the part worth testing.
 *
 * State is deliberately only two things -- the target and what was actually
 * pressed. Everything the renderer and the statistics need is derived from
 * those, which is what makes "backspace anywhere" fall out for free instead of
 * needing a second code path.
 */

/** How a single position should be drawn. */
export type CellState = "done" | "wrong" | "pending";

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

  constructor(target: string) {
    // Split by code point, not by UTF-16 unit, so one press is always one cell.
    this.chars = Array.from(target);
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

  /** True while any typed position is wrong -- the whole tail then reads red. */
  get isError(): boolean {
    return this.error !== -1;
  }

  /** Finished only when every position was typed and nothing is left wrong. */
  get done(): boolean {
    return this.pressed.length === this.chars.length && this.error === -1;
  }

  /**
   * Record a keypress. Returns whether it matched, so the caller can tally it
   * without re-deriving the answer.
   *
   * Input past the end of the target is ignored: that bounds the buffer, and
   * an unfixed mistake already blocks completion without needing to overrun.
   */
  type(ch: string): boolean {
    if (this.pressed.length >= this.chars.length) return false;
    const index = this.pressed.length;
    const correct = this.chars[index] === ch;
    this.pressed.push(ch);
    if (!correct && this.error === -1) this.error = index;
    return correct;
  }

  /**
   * Delete one position. This may run back through *correct* text and all the
   * way to the start -- nothing is locked in once typed.
   */
  backspace(): boolean {
    if (this.pressed.length === 0) return false;
    this.pressed.pop();
    // Only the first mismatch is tracked, so removing it is the only way the
    // error can clear -- anything earlier than it matched by definition.
    if (this.error === this.pressed.length) this.error = -1;
    return true;
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
    if (index >= this.pressed.length) return { expected, typed: null, state: "pending" };
    const typed = this.pressed[index] ?? "";
    const wrong = this.error !== -1 && index >= this.error;
    return { expected, typed, state: wrong ? "wrong" : "done" };
  }
}
