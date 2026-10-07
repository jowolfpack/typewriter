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

  it("accepts a plain quote where the text has a typographic one", () => {
    const session = new TypingSession("„Ja“");
    typeAll(session, String.fromCharCode(34) + "Ja" + String.fromCharCode(34));
    expect(session.done).toBe(true);
    expect(session.isError).toBe(false);
  });

  it("accepts a hyphen for a dash and a period for an ellipsis", () => {
    const session = new TypingSession("a — b…");
    typeAll(session, "a - b.");
    expect(session.done).toBe(true);
  });

  it("still shows the real character after a stand-in was typed", () => {
    const session = new TypingSession("„Ja“");
    typeAll(session, String.fromCharCode(34));
    expect(session.cellAt(0)).toEqual({ expected: "„", typed: String.fromCharCode(34), state: "done" });
  });

  it("does not accept a stand-in the other way round", () => {
    const session = new TypingSession(String.fromCharCode(34));
    typeAll(session, "„");
    expect(session.isError).toBe(true);
  });

  it("treats a line break as an ordinary position", () => {
    const session = new TypingSession("eins\nzwei");
    typeAll(session, "eins");
    expect(session.isError).toBe(false);
    session.type(" ");
    expect(session.isError).toBe(true);
    session.backspace();
    session.type("\n");
    typeAll(session, "zwei");
    expect(session.done).toBe(true);
  });

  it("treats one code point as one cell", () => {
    const session = new TypingSession("grüß");
    typeAll(session, "grüß");
    expect(session.length).toBe(4);
    expect(session.done).toBe(true);
  });
});

describe("TypingSession by heart", () => {
  const byHeart = (text: string) => new TypingSession(text, { optionalPunctuation: true });

  it("fills in punctuation when the next letter is typed", () => {
    const session = byHeart("Wind, und");
    typeAll(session, "Wind und");
    expect(session.isError).toBe(false);
    expect(session.done).toBe(true);
    expect(session.cellAt(4).state).toBe("skipped");
  });

  it("still accepts the punctuation when it is typed", () => {
    const session = byHeart("Wind, und");
    typeAll(session, "Wind, und");
    expect(session.done).toBe(true);
    expect(session.cellAt(4).state).toBe("done");
  });

  it("skips a mark together with its space, as before a dash", () => {
    const session = byHeart("Gesicht? —\nSiehst");
    typeAll(session, "Gesicht\nSiehst");
    expect(session.isError).toBe(false);
    expect(session.done).toBe(true);
  });

  it("skips opening quotes at the start of a line", () => {
    const session = byHeart("„Du liebes Kind");
    typeAll(session, "Du liebes Kind");
    expect(session.done).toBe(true);
  });

  it("fills in punctuation after the last word", () => {
    const session = byHeart("war tot.“ —");
    typeAll(session, "war tot");
    expect(session.done).toBe(true);
  });

  it("never skips a bare space -- that is where a word ends", () => {
    const session = byHeart("Wind und");
    typeAll(session, "Windu");
    expect(session.isError).toBe(true);
    expect(session.firstError).toBe(4);
  });

  it("never skips a line break", () => {
    const session = byHeart("Arm,\nEr");
    typeAll(session, "Arm E");
    expect(session.isError).toBe(true);
  });

  it("does not skip anything in a red run", () => {
    const session = byHeart("ab, cd");
    typeAll(session, "ax");
    session.type("c");
    expect(session.cursor).toBe(3);
  });

  it("takes filled-in marks back out with the letter that brought them", () => {
    const session = byHeart("Wind, und");
    typeAll(session, "Wind u");
    session.backspace();
    session.backspace();
    expect(session.cursor).toBe(4);
    expect(session.cellAt(4).state).toBe("pending");
  });

  it("reports where the keystroke landed", () => {
    const session = byHeart("a, b");
    typeAll(session, "a ");
    expect(session.judged).toEqual([{ index: 2, key: " ", correct: true }]);
  });

  it("skips punctuation before a ß typed as ss", () => {
    const session = byHeart("„ßa");
    typeAll(session, "ssa");
    expect(session.done).toBe(true);
  });

  it("leaves punctuation strict without the option", () => {
    const session = new TypingSession("Wind, und");
    typeAll(session, "Wind ");
    expect(session.isError).toBe(true);
  });

  it("reveals the next word on a hint and counts its letters", () => {
    const session = byHeart("Mein Sohn, was");
    typeAll(session, "Mein ");
    expect(session.hint()).toEqual([5, 6, 7, 8]);
    expect(session.cellAt(5).state).toBe("hinted");
    expect(session.cellAt(9).state).toBe("hinted");
    expect(session.cellAt(11).state).toBe("pending");
  });

  it("reveals a line break on its own", () => {
    const session = byHeart("Arm\nEr");
    typeAll(session, "Arm");
    expect(session.hint()).toEqual([3]);
  });

  it("does not count a position twice when hinted again", () => {
    const session = byHeart("eins zwei");
    session.hint();
    expect(session.hint()).toEqual([]);
  });
});

describe("ß typed as ss", () => {
  it("accepts ss for ß", () => {
    const session = new TypingSession("daß er");
    typeAll(session, "dass er");
    expect(session.done).toBe(true);
    expect(session.isError).toBe(false);
  });

  it("still accepts ß itself", () => {
    const session = new TypingSession("daß");
    typeAll(session, "daß");
    expect(session.done).toBe(true);
  });

  it("waits after the first s without judging", () => {
    const session = new TypingSession("daß");
    typeAll(session, "das");
    expect(session.cursor).toBe(2);
    expect(session.done).toBe(false);
    expect(session.judged).toEqual([]);
    expect(session.cellAt(2)).toEqual({ expected: "ß", typed: "s", state: "done" });
  });

  it("counts a lone s as wrong and carries on after it", () => {
    const session = new TypingSession("daß er");
    typeAll(session, "das");
    session.type(" ");
    expect(session.firstError).toBe(2);
    expect(session.cursor).toBe(4);
    expect(session.judged).toEqual([
      { index: 2, key: "s", correct: false },
      { index: 3, key: " ", correct: true },
    ]);
    expect(session.cellAt(2)).toEqual({ expected: "ß", typed: "s", state: "wrong" });
  });

  it("takes ss back one s at a time", () => {
    const session = new TypingSession("daß");
    typeAll(session, "dass");
    session.backspace();
    expect(session.done).toBe(false);
    expect(session.cellAt(2).typed).toBe("s");
    session.backspace();
    expect(session.cursor).toBe(2);
    expect(session.cellAt(2).state).toBe("pending");
    typeAll(session, "ss");
    expect(session.done).toBe(true);
  });

  it("blames the s key, which is the one pressed", () => {
    const session = new TypingSession("ß");
    typeAll(session, "ss");
    expect(session.judged).toEqual([{ index: 0, key: "s", correct: true }]);
  });
});
