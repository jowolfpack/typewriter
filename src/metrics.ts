/**
 * Speed and accuracy. Separate from `TypingSession` on purpose: the session
 * holds what is on screen now, the tally is append-only history of how it got
 * there, and the two must not be able to disagree.
 */

/** A position is judged by its *first* attempt, so retyping cannot launder it. */
const FIRST_ATTEMPT_ONLY = true;

/**
 * Longest gap between keystrokes that still counts as typing. A pause longer
 * than this is a coffee break, not slow typing, and crediting it would make
 * every honest session look terrible. It also covers a switched tab, which is
 * just a very long gap -- no blur handling needed.
 */
const IDLE_MS = 3000;

/** Characters per "word" in the conventional WPM definition. */
const CHARS_PER_WORD = 5;

/** Per-key counts, for the weak-spot list. */
export interface KeyCount {
  attempts: number;
  misses: number;
}

/** What the live bar and the summary both read. */
export interface Snapshot {
  readonly wpm: number;
  readonly accuracy: number;
  readonly correct: number;
  readonly errors: number;
  /** Of the errors, how many were positions revealed by a hint. */
  readonly hints: number;
  readonly ms: number;
}

export class Metrics {
  private readonly keys = new Map<string, KeyCount>();
  private readonly judged = new Set<number>();
  private correct = 0;
  private errors = 0;
  private hints = 0;
  private accumulated = 0;
  private last: number | null = null;

  /** `now` is injectable so the timing tests do not need real clocks. */
  constructor(private readonly now: () => number = () => Date.now()) {}

  /**
   * Tally one keypress against the position it landed on. Positions already
   * judged are ignored: backspacing over a mistake and typing it correctly
   * still counts as the miss it was.
   */
  record(index: number, expected: string, correct: boolean): void {
    this.tick();
    if (FIRST_ATTEMPT_ONLY && this.judged.has(index)) return;
    this.judged.add(index);
    if (correct) this.correct += 1;
    else this.errors += 1;

    const key = this.keys.get(expected) ?? { attempts: 0, misses: 0 };
    key.attempts += 1;
    if (!correct) key.misses += 1;
    this.keys.set(expected, key);
  }

  /**
   * Positions a hint revealed before they were typed. Each is a miss -- it was
   * not known -- judged now, so typing it afterwards cannot turn it into a hit.
   * No key is blamed: forgetting a word is not a finger's fault.
   */
  recordHint(indices: readonly number[]): void {
    this.tick();
    for (const index of indices) {
      if (this.judged.has(index)) continue;
      this.judged.add(index);
      this.errors += 1;
      this.hints += 1;
    }
  }

  /**
   * Backspaces are not keystrokes -- they do not count against accuracy -- but
   * they do keep the clock running, or deleting a long mistake would read as
   * idle time.
   */
  recordBackspace(): void {
    this.tick();
  }

  /** Advance the clock by the gap since the last event, capped at `IDLE_MS`. */
  private tick(): void {
    const now = this.now();
    if (this.last !== null) this.accumulated += Math.min(now - this.last, IDLE_MS);
    this.last = now;
  }

  /** Elapsed typing time, including the live gap since the last keystroke. */
  elapsedMs(): number {
    if (this.last === null) return 0;
    return this.accumulated + Math.min(this.now() - this.last, IDLE_MS);
  }

  /** Everything the UI shows, computed fresh -- nothing here is cached. */
  snapshot(): Snapshot {
    const ms = this.elapsedMs();
    const attempted = this.correct + this.errors;
    const minutes = ms / 60000;
    return {
      wpm: minutes > 0 ? this.correct / CHARS_PER_WORD / minutes : 0,
      accuracy: attempted > 0 ? this.correct / attempted : 1,
      correct: this.correct,
      errors: this.errors,
      hints: this.hints,
      ms,
    };
  }

  /** Per-key counts, worst first, for the weak-spot list and for storage. */
  keyCounts(): ReadonlyMap<string, KeyCount> {
    return this.keys;
  }
}
