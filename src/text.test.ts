import { describe, expect, it } from "vitest";
import { clean, extractHeader, looksWrapped, prepare, toChunks } from "./text";

/** A stanza, as a poem is actually written. */
const PANTHER = [
  "Sein Blick ist vom Vorübergehn der Stäbe",
  "so müd geworden, dass er nichts mehr hält.",
].join("\n");

/** Prose wrapped at a margin, the way Project Gutenberg ships it. */
const WRAPPED = [
  "I went to the woods because I wished to live deliberately, to front",
  "only the essential facts of life, and see if I could not learn what it",
  "had to teach, and not, when I came to die, discover that I had not",
  "lived.",
].join("\n");

describe("clean", () => {
  it("strips a byte-order mark", () => {
    expect(clean("﻿Hallo")).toBe("Hallo");
  });

  it("composes decomposed umlauts into one code point", () => {
    expect(Array.from(clean("ö"))).toHaveLength(1);
    expect(clean("ö")).toBe("ö");
  });

  it("normalises Windows line endings", () => {
    expect(clean("a\r\nb")).toBe("a\nb");
  });

  it("removes invisible characters, which no key can produce", () => {
    expect(clean("we­iter​hin")).toBe("weiterhin");
  });

  it("leaves real punctuation exactly as written", () => {
    const quoted = "„Guten Tag“ – sagte er…";
    expect(clean(quoted)).toBe(quoted);
  });
});

describe("extractHeader", () => {
  it("takes a leading heading and removes it from the body", () => {
    const { title, body } = extractHeader("# Die Verwandlung\nAls Gregor...");
    expect(title).toBe("Die Verwandlung");
    expect(body).toBe("Als Gregor...");
  });

  it("leaves a text with no heading alone", () => {
    expect(extractHeader("Als Gregor...").title).toBeNull();
  });

  it("takes a source link under the heading and keeps it out of the typing", () => {
    const { title, source, body } = extractHeader(
      "# Der Zauberlehrling\nSource: https://de.wikisource.org/wiki/X\n\nHat der alte Hexenmeister",
    );
    expect(title).toBe("Der Zauberlehrling");
    expect(source).toBe("https://de.wikisource.org/wiki/X");
    expect(body).toBe("\nHat der alte Hexenmeister");
  });

  it("only treats a web address as a source, never a line of the text", () => {
    const { source, body } = extractHeader("Source: of all my troubles\nwas you");
    expect(source).toBeNull();
    expect(body).toBe("Source: of all my troubles\nwas you");
  });
});

describe("toChunks", () => {
  it("keeps a stanza's line breaks", () => {
    expect(toChunks(PANTHER, false)).toEqual([PANTHER]);
  });

  it("joins those same lines when asked to", () => {
    expect(toChunks(PANTHER, true)).toEqual([PANTHER.replace("\n", " ")]);
  });

  it("makes one chunk per paragraph", () => {
    expect(toChunks("One para.\n\nTwo para.", true)).toEqual(["One para.", "Two para."]);
  });

  it("drops blank paragraphs and collapses runs of spaces", () => {
    expect(toChunks("a   b\n\nd", true)).toEqual(["a b", "d"]);
  });

  it("splits an over-long paragraph at sentence ends", () => {
    const paragraph = `${"a".repeat(200)}. ${"b".repeat(200)}.`;
    const chunks = toChunks(paragraph, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(`${"a".repeat(200)}.`);
  });

  it("splits a long poem between its lines, never inside one", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `Zeile ${i} mit einigen Worten darin`);
    for (const chunk of toChunks(lines.join("\n"), false)) {
      for (const line of chunk.split("\n")) expect(lines).toContain(line);
    }
  });

  it("never breaks a word in half", () => {
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    expect(toChunks(words, true).join(" ")).toBe(words);
  });
});

describe("looksWrapped", () => {
  it("recognises prose wrapped at a margin", () => {
    expect(looksWrapped(WRAPPED)).toBe(true);
  });

  it("does not mistake verse for wrapping", () => {
    const poem = [PANTHER, "Der weiche Gang geschmeidig starker Schritte,", "der sich dreht."].join(
      "\n",
    );
    expect(looksWrapped(poem)).toBe(false);
  });

  it("says nothing about a paragraph that is already one line", () => {
    expect(looksWrapped("A single unwrapped paragraph of perfectly ordinary prose.")).toBe(false);
  });
});

describe("prepare", () => {
  it("keeps the text as written, punctuation and all", () => {
    const { chunks } = prepare("„Hallo“ — er ging…", false);
    expect(chunks[0]).toBe("„Hallo“ — er ging…");
  });

  it("reports a wrapped file without changing it", () => {
    const prepared = prepare(WRAPPED, false);
    expect(prepared.wrapped).toBe(true);
    expect(prepared.chunks[0]).toContain("\n");
  });

  it("puts the paragraph back together when told to", () => {
    const prepared = prepare(WRAPPED, true);
    expect(prepared.chunks[0]).not.toContain("\n");
    expect(prepared.chunks[0]).toContain("wished to live deliberately");
  });

  it("keeps a poem in one piece, the blank line between stanzas included", () => {
    const poem = "# T\n\none a\none b\n\n\ntwo a\ntwo b\n";
    const prepared = prepare(poem, false);
    expect(prepared.verse).toBe(true);
    expect(prepared.chunks).toEqual(["one a\none b\n\ntwo a\ntwo b"]);
  });

  it("does not take prose with one paragraph per line for a poem", () => {
    const prose = "First paragraph.\n\nSecond paragraph.\n\nThird.";
    const prepared = prepare(prose, false);
    expect(prepared.verse).toBe(false);
    expect(prepared.chunks).toHaveLength(3);
  });

  it("splits a wrapped file into parts even with its lines kept", () => {
    expect(prepare(WRAPPED, false).verse).toBe(false);
  });
});
