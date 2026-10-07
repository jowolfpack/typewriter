/**
 * @vitest-environment jsdom
 *
 * Drives the real index.html: pick a text, type it, make a mistake, fix it,
 * finish. This is what catches the wiring mistakes the pure suites cannot see
 * -- a renamed id, a screen that never unhides, input that never reaches the
 * session, a position that is not saved.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepare } from "./text";

// Not import.meta.url: under the jsdom environment that is an http URL.
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");
const css = readFileSync(resolve(process.cwd(), "src/style.css"), "utf-8");

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing #${id}`);
  return node as T;
}

function visible(id: string): boolean {
  return !byId(id).hidden;
}

/**
 * Vite hands the stylesheet to the app as a side-effect import, which vitest
 * stubs out -- so the real CSS has to be put in by hand or these tests would
 * pass while the page looked nothing like this.
 */
function applyStylesheet(): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
}

/**
 * The tests bring their own prose rather than leaning on `texts/`, which holds
 * only what the user chose and may change at any time. It is put in the way
 * the app's own import button stores a text.
 */
const PRACTICE_TITLE = "Practice Prose";
const PRACTICE = [
  "The quick brown fox jumps over the lazy dog, then rests in the shade a while.",
  "A second paragraph follows, so that the text has more than one part.",
].join("\n\n");

/** Fresh DOM plus a fresh module instance, since main.ts runs on import. */
async function boot(): Promise<void> {
  document.documentElement.innerHTML = html;
  applyStylesheet();
  localStorage.clear();
  localStorage.setItem(
    "typewriter:profile",
    JSON.stringify({
      version: 1,
      imported: [{ id: "imported:practice", title: PRACTICE_TITLE, lang: "en", raw: PRACTICE }],
    }),
  );
  document.documentElement.removeAttribute("data-theme");
  vi.resetModules();
  await import("./main");
}

/** Type through the real input path: the field's value, not synthetic keys. */
function type(text: string): void {
  const capture = byId<HTMLInputElement>("capture");
  for (const ch of text) {
    capture.value = ch;
    capture.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function backspace(): void {
  byId("capture").dispatchEvent(
    new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
  );
}

/** The library rows, as the user sees them. */
function entries(listId: string): HTMLButtonElement[] {
  return [...byId(listId).querySelectorAll<HTMLButtonElement>("button.entry")];
}

function open(listId: string, name: string): void {
  const match = entries(listId).find((button) => button.textContent?.includes(name) === true);
  if (match === undefined) throw new Error(`No entry named ${name}`);
  match.click();
}

/** What the line is currently showing, cell by cell. */
function cells(): Array<{ text: string; state: string }> {
  return [...document.querySelectorAll(".stream-strip span")].map((span) => ({
    text: span.textContent ?? "",
    state: span.className,
  }));
}

function firstChunk(): string {
  const first = prepare(PRACTICE, true).chunks[0];
  if (first === undefined) throw new Error("Practice text has no chunks");
  return first;
}

beforeEach(async () => {
  await boot();
});

describe("screens", () => {
  /**
   * `section { display: grid }` outranks the browser's `[hidden]` rule, which
   * once left all four screens rendering at once while every `.hidden` check
   * in this file still passed. Assert what is painted, not what is set.
   */
  it("really hides the screens it is not showing", () => {
    for (const id of ["type", "done", "history"]) {
      expect(getComputedStyle(byId(id)).display).toBe("none");
    }
    open("text-list", PRACTICE_TITLE);
    expect(getComputedStyle(byId("home")).display).toBe("none");
    expect(getComputedStyle(byId("type")).display).not.toBe("none");
  });
});

describe("the library", () => {
  it("opens on the library with its texts and the lesson ladder", () => {
    expect(visible("home")).toBe(true);
    expect(visible("type")).toBe(false);
    expect(entries("text-list").map((b) => b.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining(PRACTICE_TITLE)]),
    );
    expect(entries("lesson-list").length).toBeGreaterThan(10);
  });

  it("shows German texts and a German ladder after the switch", () => {
    const lang = byId<HTMLSelectElement>("lang");
    lang.value = "de";
    lang.dispatchEvent(new Event("change"));

    const titles = entries("text-list").map((b) => b.textContent ?? "");
    expect(titles.some((title) => title.includes("Der Zauberlehrling"))).toBe(true);
    expect(titles.some((title) => title.includes(PRACTICE_TITLE))).toBe(false);
    expect(byId("layout-name").textContent).toContain("QWERTZ");
    expect(entries("lesson-list").some((b) => b.textContent?.includes("ß") === true)).toBe(
      true,
    );
  });
});

describe("typing a text", () => {
  it("shows the line and moves the cursor as you type", () => {
    open("text-list", PRACTICE_TITLE);
    expect(visible("type")).toBe(true);

    const chunk = firstChunk();
    type(chunk.slice(0, 4));

    const painted = cells();
    expect(painted.slice(0, 4).every((cell) => cell.state === "done")).toBe(true);
    expect(painted[4]?.state).toBe("pending");
  });

  it("reddens the whole tail after a mistake and clears it on backspace", () => {
    open("text-list", PRACTICE_TITLE);
    const chunk = firstChunk();

    type(`${chunk.slice(0, 3)}X`);
    type(chunk.slice(4, 6));
    expect(byId("stream-slot").querySelector(".stream")?.classList.contains("is-error")).toBe(true);
    expect(cells()[3]).toEqual({ text: "X", state: "wrong" });
    expect(cells()[4]?.state).toBe("wrong");

    backspace();
    backspace();
    expect(cells()[3]?.state).toBe("wrong");
    backspace();
    expect(byId("stream-slot").querySelector(".stream")?.classList.contains("is-error")).toBe(
      false,
    );
    expect(cells()[3]?.state).toBe("pending");
  });

  it("lets backspace run back through correct text", () => {
    open("text-list", PRACTICE_TITLE);
    type(firstChunk().slice(0, 5));
    for (let i = 0; i < 5; i += 1) backspace();
    expect(cells()[0]?.state).toBe("pending");
  });

  it("cannot finish while a mistake is still on the line", () => {
    open("text-list", PRACTICE_TITLE);
    const chunk = firstChunk();
    type(`X${chunk.slice(1)}`);
    expect(visible("done")).toBe(false);
    expect(visible("type")).toBe(true);
  });

  it("finishes on an exact match and reports the session", () => {
    open("text-list", PRACTICE_TITLE);
    type(firstChunk());

    expect(visible("done")).toBe(true);
    expect(byId("summary").textContent).toMatch(/wpm/);
    const stored = localStorage.getItem("typewriter:profile") ?? "";
    expect(stored).toContain(PRACTICE_TITLE);
  });

  it("resumes the next part when the text is reopened", async () => {
    open("text-list", PRACTICE_TITLE);
    type(firstChunk());
    byId("to-library").click();

    const row = entries("text-list").find((b) => b.textContent?.includes(PRACTICE_TITLE) === true);
    expect(row?.textContent).toContain("part 2 of");

    // And it survives a reload, because the position is in storage, not memory.
    document.documentElement.innerHTML = html;
    vi.resetModules();
    await import("./main");
    const again = entries("text-list").find((b) => b.textContent?.includes(PRACTICE_TITLE) === true);
    expect(again?.textContent).toContain("part 2 of");
  });

  it("goes back to the library on Escape", () => {
    open("text-list", PRACTICE_TITLE);
    byId("capture").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    expect(visible("home")).toBe(true);
  });
});

describe("the interface", () => {
  it("hides the statistics without leaving the text", () => {
    open("text-list", PRACTICE_TITLE);
    expect(visible("typing-meta")).toBe(true);

    const toggle = byId<HTMLInputElement>("stats-toggle");
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));

    expect(visible("typing-meta")).toBe(false);
    expect(visible("type")).toBe(true);
  });

  it("stamps the theme on the document", () => {
    const theme = byId<HTMLSelectElement>("theme");
    theme.value = "light";
    theme.dispatchEvent(new Event("change"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("opens the history view from the header", () => {
    byId("history-link").click();
    expect(visible("history")).toBe(true);
    expect(byId("weak-summary").textContent).toBeTruthy();
  });
});

describe("a poem", () => {
  function openPoem(): void {
    const lang = byId<HTMLSelectElement>("lang");
    lang.value = "de";
    lang.dispatchEvent(new Event("change"));
    open("text-list", "Der Zauberlehrling");
  }

  function rows(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(".verse-row:not(.context):not(.gap)")];
  }

  function enter(): void {
    // A one-line field never holds a newline: Enter arrives as a key.
    byId("capture").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
  }

  it("links to where the text came from", () => {
    const lang = byId<HTMLSelectElement>("lang");
    lang.value = "de";
    lang.dispatchEvent(new Event("change"));
    const link = byId("text-list").querySelector<HTMLAnchorElement>("a.entry-source");
    expect(link?.href).toContain("de.wikisource.org");
    expect(link?.rel).toContain("noopener");
  });

  it("is the whole poem in one piece, laid out line by line", () => {
    openPoem();
    expect(document.querySelector(".stream-strip")).toBeNull();
    const lines = rows().map((row) => (row.textContent ?? "").replace("↵", ""));
    expect(lines[0]).toBe("Hat der alte Hexenmeister");
    // 98 verse lines and the 13 blank lines between the 14 stanzas.
    expect(lines).toHaveLength(98 + 13);
    expect(lines[8]).toBe("");
    expect(lines.at(-1)).toBe("Erst hervor der alte Meister.“");
    expect(rows()[0]?.classList.contains("is-current")).toBe(true);
    expect(byId("typing-meta").textContent).toContain("line 1 of 98");
  });

  it("types the blank line between stanzas as a second Enter", () => {
    openPoem();
    const first = [
      "Hat der alte Hexenmeister",
      "Sich doch einmal wegbegeben!",
      "Und nun sollen seine Geister",
      "Auch nach meinem Willen leben.",
      "Seine Wort’ und Werke",
      "Merkt’ ich, und den Brauch,",
      "Und mit Geistesstärke",
      "Thu’ ich Wunder auch.",
    ];
    for (const verse of first) {
      type(verse);
      enter();
    }
    expect(rows()[8]?.classList.contains("is-current")).toBe(true);
    enter();
    expect(rows()[9]?.classList.contains("is-current")).toBe(true);
    expect(byId("typing-meta").textContent).toContain("line 9 of 98");
    expect(visible("type")).toBe(true);
  });

  it("moves the mark down when Enter ends a line", () => {
    openPoem();
    type("Hat der alte Hexenmeister");
    enter();
    expect(rows()[0]?.classList.contains("is-current")).toBe(false);
    expect(rows()[0]?.classList.contains("is-past")).toBe(true);
    expect(rows()[1]?.classList.contains("is-current")).toBe(true);
    expect(rows()[1]?.querySelector(".at-caret")?.textContent).toBe("S");
  });

  it("still stops at a mistake and shows what was typed", () => {
    openPoem();
    type("Hat dex");
    expect(byId("stream-slot").querySelector(".stream")?.classList.contains("is-error")).toBe(
      true,
    );
    expect(rows()[0]?.querySelector(".wrong")?.textContent).toBe("x");
  });
});

describe("a poem by heart", () => {
  /** The test's own verse, not one from `texts/`: two stanzas, punctuation on purpose. */
  const POEM = [
    "Ein Vers, der steht;",
    "ein zweiter — hier.",
    "",
    "„Und dann der Schluss,",
    "ganz kurz.“",
  ].join("\n");

  function openByHeart(): void {
    localStorage.setItem(
      "typewriter:profile",
      JSON.stringify({
        version: 1,
        imported: [{ id: "imported:verse", title: "Test Verse", lang: "de", raw: POEM }],
      }),
    );
    const lang = byId<HTMLSelectElement>("lang");
    lang.value = "de";
    lang.dispatchEvent(new Event("change"));
    const row = entries("text-list")
      .find((button) => button.textContent?.includes("Test Verse") === true)
      ?.closest("li");
    const button = [...(row?.querySelectorAll("button") ?? [])].find(
      (candidate) => candidate.textContent === "by heart",
    );
    if (button === undefined) throw new Error("No by-heart button on the poem");
    button.click();
  }

  function key(name: string): void {
    byId("capture").dispatchEvent(
      new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
    );
  }

  function pending(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(".verse-row .pending")];
  }

  it("hides everything not yet typed", () => {
    openByHeart();
    expect(byId("title").textContent).toContain("by heart");
    expect(pending().length).toBeGreaterThan(0);
    for (const cell of pending()) {
      expect(["transparent", "rgba(0, 0, 0, 0)"]).toContain(getComputedStyle(cell).color);
    }
  });

  it("finishes with the punctuation left out", () => {
    openByHeart();
    for (const line of ["Ein Vers der steht", "ein zweiter hier", "", "Und dann der Schluss"]) {
      type(line);
      key("Enter");
    }
    type("ganz kurz");
    expect(visible("done")).toBe(true);
    expect(byId("summary").textContent).toContain("100.0%");
  });

  it("still requires Enter where a line ends", () => {
    openByHeart();
    type("Ein Vers der steht ein");
    expect(byId("stream-slot").querySelector(".stream")?.classList.contains("is-error")).toBe(
      true,
    );
  });

  it("shows the next word on Tab and counts it", () => {
    openByHeart();
    key("Tab");
    const hinted = [...document.querySelectorAll(".verse-row .hinted")].map((c) => c.textContent);
    expect(hinted.join("")).toBe("Ein");
    expect(byId("typing-meta").textContent).toContain("3 hinted");
    expect(byId("type-hint").textContent).toContain("Tab");
  });
});

describe("a lesson", () => {
  it("only asks for keys the rung has unlocked", () => {
    open("lesson-list", "Home keys");
    const shown = cells()
      .map((cell) => cell.text)
      .join("");
    expect(shown.replace(/ /g, "")).toMatch(/^[fj]+$/);
  });
});
