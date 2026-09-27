/**
 * A poem laid out as a poem: one row per verse line, the line being typed
 * marked in the middle, what came before above it and what is coming below.
 *
 * The single scrolling strip in `stream.ts` is right for prose, where a line
 * break is an accident of the margin. In verse the lineation is the poem, and a
 * strip shows it only as a row of `↵` marks -- you type the words but never see
 * the shape. Here the rows scroll up instead of the letters sideways.
 *
 * Same idiom as `TypeLine`: DOM built once per chunk, then only `update()`.
 */

import { paintCell } from "./stream";
import type { TypingSession } from "./typing";

/** The neighbouring parts, shown dimmed so a stanza is never read out of place. */
export interface VerseContext {
  readonly before: string;
  readonly after: string;
}

export class VerseLines {
  readonly element: HTMLDivElement;
  private readonly lines: HTMLDivElement;
  private cells: HTMLSpanElement[] = [];
  /** The rows of the part being typed, and which of them each cell sits in. */
  private rows: HTMLDivElement[] = [];
  private rowOf: number[] = [];
  /** How many rows of context and spacing come before the first typed row. */
  private offset = 0;

  constructor() {
    this.lines = document.createElement("div");
    this.lines.className = "verse-lines";

    const window = document.createElement("div");
    window.className = "verse-window";
    window.append(this.lines);

    this.element = document.createElement("div");
    this.element.className = "stream verse";
    this.element.append(window);
  }

  /** Lay out a new part. Rows only change here, never per keystroke. */
  reset(session: TypingSession, context: VerseContext = { before: "", after: "" }): void {
    const rows: HTMLDivElement[] = [];
    const before = splitRows(context.before);
    const after = splitRows(context.after);

    for (const text of before) rows.push(contextRow(text));
    if (before.length > 0) rows.push(gapRow());
    this.offset = rows.length;

    this.cells = [];
    this.rows = [];
    this.rowOf = [];
    let row = typedRow();
    for (let i = 0; i < session.length; i += 1) {
      const span = document.createElement("span");
      row.append(span);
      this.cells.push(span);
      this.rowOf.push(this.rows.length);
      // The break belongs to the end of its line, where Enter is pressed.
      if (session.expectedAt(i) === "\n") {
        this.rows.push(row);
        row = typedRow();
      }
    }
    if (row.childElementCount > 0) this.rows.push(row);
    rows.push(...this.rows);

    if (after.length > 0) rows.push(gapRow());
    for (const text of after) rows.push(contextRow(text));

    // Shrink the type until the longest line fits, so a verse line is never cut
    // or scrolled sideways -- the whole point is to see it whole. `+ 1` leaves
    // room for the break mark.
    const widest = Math.max(
      1,
      ...before.map((text) => text.length),
      ...after.map((text) => text.length),
      ...this.rows.map((r) => r.childElementCount),
    );
    this.element.style.setProperty("--cols", String(widest + 1));

    this.lines.replaceChildren(...rows);
    this.lines.style.transition = "none";
    this.update(session);
    // Same trick as TypeLine.reset: apply the jump before the glide returns.
    void this.lines.offsetWidth;
    this.lines.style.transition = "";
  }

  update(session: TypingSession): void {
    const count = Math.min(session.length, this.cells.length);
    const caret = session.done ? -1 : session.cursor;
    for (let i = 0; i < count; i += 1) {
      const span = this.cells[i];
      if (span !== undefined) paintCell(span, session.cellAt(i), i === caret ? "at-caret" : "");
    }

    // When the part is finished the caret is past the end; keep the last row.
    const current = this.rowOf[Math.min(session.cursor, count - 1)] ?? 0;
    this.rows.forEach((row, index) => {
      row.classList.toggle("is-current", index === current);
      row.classList.toggle("is-past", index < current);
    });
    this.lines.style.setProperty("--row", String(this.offset + current));
    this.element.classList.toggle("is-error", session.isError);
  }
}

function splitRows(text: string): string[] {
  return text === "" ? [] : text.split("\n");
}

function typedRow(): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "verse-row";
  return row;
}

function contextRow(text: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "verse-row context";
  row.textContent = text;
  return row;
}

/** The blank line between stanzas, kept so the shape reads as it does in print. */
function gapRow(): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "verse-row gap";
  return row;
}
