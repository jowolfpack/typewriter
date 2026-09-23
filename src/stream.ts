/**
 * The line of text you type against: grey ahead, plain behind, red from a
 * mistake onward, scrolling right to left past a caret that never moves.
 *
 * A widget in StateLearner's idiom -- it builds its DOM once, exposes
 * `element`, and changes only through `update()`.
 */

import type { TypingSession } from "./typing";

/** A wrongly typed space needs a body, or the red run has an invisible gap. */
const SPACE_MARKER = "·";

export class TypeLine {
  readonly element: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  /** Reused between renders: recreating a few hundred spans per keystroke shows. */
  private readonly cells: HTMLSpanElement[] = [];

  constructor() {
    this.strip = document.createElement("div");
    this.strip.className = "stream-strip";

    const window = document.createElement("div");
    window.className = "stream-window";
    window.append(this.strip);

    const caret = document.createElement("div");
    caret.className = "stream-caret";

    this.element = document.createElement("div");
    this.element.className = "stream";
    this.element.append(window, caret);
  }

  /**
   * Redraw from the session. Called on every keystroke, so it stays cheap.
   *
   * The whole chunk is in the DOM rather than a window around the caret.
   * `text.ts` caps a chunk at a few hundred characters, so there is nothing to
   * save -- and a window that slides would drop cells off the front, moving the
   * line by a character with no transition to carry it. The scroll has to be
   * one continuous glide or it is not calming.
   */
  update(session: TypingSession): void {
    const count = session.length;

    while (this.cells.length < count) {
      const span = document.createElement("span");
      this.strip.append(span);
      this.cells.push(span);
    }
    while (this.cells.length > count) {
      this.cells.pop()?.remove();
    }

    for (let i = 0; i < count; i += 1) {
      const cell = session.cellAt(i);
      const span = this.cells[i];
      if (span === undefined) continue;
      // Show what was actually pressed at a wrong position: seeing the letter
      // you produced is what tells you which one to delete.
      const shown = cell.state === "wrong" ? (cell.typed ?? cell.expected) : cell.expected;
      const text = cell.state === "wrong" && shown === " " ? SPACE_MARKER : shown;
      if (span.textContent !== text) span.textContent = text;
      if (span.className !== cell.state) span.className = cell.state;
    }

    // The caret is fixed in the window, so the strip is what moves. `ch` units
    // are exact here because the line is monospace -- nothing to measure.
    this.strip.style.transform = `translateX(-${session.cursor}ch)`;
    this.element.classList.toggle("is-error", session.isError);
  }

  /** Start again from the left with no animation, when a new chunk is loaded. */
  reset(session: TypingSession): void {
    this.strip.style.transition = "none";
    this.update(session);
    // Read back a layout value so the browser applies the jump before the
    // transition comes back; without it the new chunk slides in from the old
    // offset.
    void this.strip.offsetWidth;
    this.strip.style.transition = "";
  }
}
