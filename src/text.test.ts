import { describe, expect, it } from "vitest";
import { clean, extractTitle, normaliseTypography, prepare, toChunks } from "./text";

describe("clean", () => {
  it("strips a byte-order mark", () => {
    expect(clean("﻿Hallo")).toBe("Hallo");
  });

  it("composes decomposed umlauts into one code point", () => {
    const decomposed = "ö";
    expect(Array.from(clean(decomposed))).toHaveLength(1);
    expect(clean(decomposed)).toBe("ö");
  });

  it("normalises Windows line endings", () => {
    expect(clean("a\r\nb")).toBe("a\nb");
  });
});

describe("normaliseTypography", () => {
  it("replaces characters no keyboard can produce", () => {
    const raw = "„Guten Tag“ – sagte er…";
    expect(normaliseTypography(raw)).toBe('"Guten Tag" - sagte er...');
  });

  it("turns a non-breaking space into a normal one", () => {
    expect(normaliseTypography("a b")).toBe("a b");
  });
});

describe("extractTitle", () => {
  it("takes a leading heading and removes it from the body", () => {
    const { title, body } = extractTitle("# Die Verwandlung\nAls Gregor...");
    expect(title).toBe("Die Verwandlung");
    expect(body).toBe("Als Gregor...");
  });

  it("leaves a text with no heading alone", () => {
    const { title, body } = extractTitle("Als Gregor...");
    expect(title).toBeNull();
    expect(body).toBe("Als Gregor...");
  });
});

describe("toChunks", () => {
  it("makes one chunk per paragraph", () => {
    expect(toChunks("One para.\n\nTwo para.")).toEqual(["One para.", "Two para."]);
  });

  it("drops blank paragraphs and collapses inner whitespace", () => {
    expect(toChunks("a   b\nc\n\n\n\nd")).toEqual(["a b c", "d"]);
  });

  it("splits an over-long paragraph at sentence ends", () => {
    const paragraph = `${"a".repeat(200)}. ${"b".repeat(200)}.`;
    const chunks = toChunks(paragraph);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(`${"a".repeat(200)}.`);
  });

  it("falls back to word boundaries for one huge sentence", () => {
    const words = Array.from({ length: 200 }, () => "wort").join(" ");
    for (const chunk of toChunks(words)) {
      expect(chunk.length).toBeLessThanOrEqual(320);
      expect(chunk.startsWith("wort")).toBe(true);
    }
  });

  it("never breaks a word in half", () => {
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    expect(toChunks(words).join(" ")).toBe(words);
  });
});

describe("prepare", () => {
  it("keeps the original characters when normalising is off", () => {
    const { chunks } = prepare("„Hallo“", false);
    expect(chunks[0]).toBe("„Hallo“");
  });

  it("normalises and chunks in one pass", () => {
    const { title, chunks } = prepare("# T\n„Hallo“\n\nZwei", true);
    expect(title).toBe("T");
    expect(chunks).toEqual(['"Hallo"', "Zwei"]);
  });
});
