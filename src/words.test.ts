import { describe, expect, it } from "vitest";
import { wordsWithin } from "./words";

describe("wordsWithin", () => {
  it("returns only words spellable from the given keys", () => {
    for (const word of wordsWithin("en", "asdfjklthe")) {
      for (const ch of word) expect("asdfjklthe").toContain(ch);
    }
    expect(wordsWithin("en", "the")).toContain("the");
  });

  it("lists every word once, so none is drawn more often than the rest", () => {
    for (const lang of ["en", "de"] as const) {
      const all = wordsWithin(lang, "abcdefghijklmnopqrstuvwxyzäöüß");
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("keeps the lists lowercase and unpunctuated", () => {
    for (const lang of ["en", "de"] as const) {
      for (const word of wordsWithin(lang, "abcdefghijklmnopqrstuvwxyzäöüß")) {
        expect(word).toMatch(/^[a-zäöüß]+$/);
      }
    }
  });
});
