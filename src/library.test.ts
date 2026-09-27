import { describe, expect, it } from "vitest";
import {
  bundledTexts,
  entryFromPath,
  langFromPath,
  libraryFor,
  looksBinary,
  titleFromPath,
} from "./library";
import { prepare } from "./text";

describe("paths", () => {
  it("reads the language off the folder", () => {
    expect(langFromPath("/texts/de/kafka.txt")).toBe("de");
    expect(langFromPath("/texts-local/en/notes.txt")).toBe("en");
  });

  it("ignores a file outside a language folder", () => {
    expect(langFromPath("/texts/kafka.txt")).toBeNull();
    expect(entryFromPath("/texts/kafka.txt", "text", "repo")).toBeNull();
  });

  it("makes a readable title out of a filename", () => {
    expect(titleFromPath("/texts/de/die-verwandlung.txt")).toBe("Die Verwandlung");
    expect(titleFromPath("/texts/en/the_open_boat.txt")).toBe("The Open Boat");
  });
});

describe("entryFromPath", () => {
  it("prefers a heading over the filename", () => {
    const entry = entryFromPath("/texts/en/w.txt", "# Walden\n\nI went to the woods.", "repo");
    expect(entry?.title).toBe("Walden");
  });

  it("falls back to the filename when there is no heading", () => {
    const entry = entryFromPath("/texts/en/open-boat.txt", "None of them knew.", "repo");
    expect(entry?.title).toBe("Open Boat");
  });

  it("flags a file that did not arrive as UTF-8", () => {
    expect(looksBinary("plain text")).toBe(false);
    expect(looksBinary("A\u0000B")).toBe(true);
    expect(entryFromPath("/texts/en/x.txt", "A�B", "repo")?.broken).toBe(true);
  });
});

describe("the bundled library", () => {
  it("picks up the seed texts from the texts/ folder", () => {
    const paths = bundledTexts().map((entry) => entry.id);
    expect(paths).toContain("/texts/de/die-verwandlung.txt");
    expect(paths).toContain("/texts/en/walden.txt");
  });

  /**
   * A poem copied from memory gets its punctuation and its line endings wrong,
   * and those are the poem. So every published one says which edition it is.
   */
  it("gives every published poem a source link", () => {
    const poems = bundledTexts().filter((entry) => {
      if (entry.source !== "repo" || entry.broken) return false;
      return prepare(entry.raw, false).verse;
    });
    expect(poems.map((entry) => entry.id)).toContain("/texts/de/der-zauberlehrling.txt");
    for (const poem of poems) {
      expect(poem.link, poem.id).toMatch(/^https:\/\//);
    }
  });

  it("shows only the chosen language, sorted, with imports mixed in", () => {
    const de = libraryFor("de", [
      { id: "imported:a", title: "Aaa", lang: "de", raw: "text" },
      { id: "imported:b", title: "Bbb", lang: "en", raw: "text" },
    ]);
    expect(de.every((entry) => entry.lang === "de")).toBe(true);
    expect(de[0]?.title).toBe("Aaa");
    expect(de.map((entry) => entry.title)).toContain("Die Verwandlung");
  });
});
