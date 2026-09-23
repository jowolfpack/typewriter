import { describe, expect, it } from "vitest";
import { TypingSession } from "./typing";

/** Type a whole string through a session, one character at a time. */
function typeAll(session: TypingSession, text: string): void {
  for (const ch of text) session.type(ch);
}

describe("TypingSession", () => {
  it("advances through a correct run", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hal");
    expect(session.cursor).toBe(3);
    expect(session.isError).toBe(false);
    expect(session.done).toBe(false);
  });

  it("completes only on an exact match", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hallo");
    expect(session.done).toBe(true);
  });

  it("reddens everything after the mistake, not just the bad letter", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hxl");
    expect(session.firstError).toBe(1);
    expect(session.cellAt(0).state).toBe("done");
    expect(session.cellAt(1).state).toBe("wrong");
    expect(session.cellAt(2).state).toBe("wrong");
    expect(session.cellAt(3).state).toBe("pending");
  });

  it("shows what was actually typed at a wrong position", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hx");
    expect(session.cellAt(1)).toEqual({ expected: "a", typed: "x", state: "wrong" });
  });

  it("cannot complete while a position is wrong", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hxllo");
    expect(session.cursor).toBe(5);
    expect(session.done).toBe(false);
    expect(session.isError).toBe(true);
  });

  it("clears the error only when the bad position itself is deleted", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hxllo");
    // Three deletions take the cursor down to 2 -- the bad "x" at index 1 is
    // still there, so the line is still red.
    for (let i = 0; i < 3; i += 1) session.backspace();
    expect(session.isError).toBe(true);
    session.backspace();
    expect(session.isError).toBe(false);
    expect(session.cursor).toBe(1);
  });

  it("lets backspace run back through correct text to the start", () => {
    const session = new TypingSession("hallo");
    typeAll(session, "hall");
    for (let i = 0; i < 4; i += 1) session.backspace();
    expect(session.cursor).toBe(0);
    expect(session.backspace()).toBe(false);
  });

  it("ignores input past the end of the target", () => {
    const session = new TypingSession("hi");
    typeAll(session, "hi");
    expect(session.type("!")).toBe(false);
    expect(session.cursor).toBe(2);
  });

  it("deletes trailing spaces and then the word on backspaceWord", () => {
    const session = new TypingSession("der schnelle Fuchs");
    typeAll(session, "der schnelle ");
    session.backspaceWord();
    expect(session.cursor).toBe(4);
  });

  it("treats one code point as one cell", () => {
    const session = new TypingSession("grüß");
    typeAll(session, "grüß");
    expect(session.length).toBe(4);
    expect(session.done).toBe(true);
  });
});
