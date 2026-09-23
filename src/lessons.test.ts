import { describe, expect, it } from "vitest";
import { drillFor, lessonById, lessonsFor, seededRandom } from "./lessons";

describe("lessonsFor", () => {
  it("carries every earlier key into the later rungs", () => {
    const rungs = lessonsFor("en");
    for (let i = 1; i < rungs.length; i += 1) {
      const previous = rungs[i - 1];
      const current = rungs[i];
      if (previous === undefined || current === undefined) throw new Error("missing rung");
      for (const key of previous.keys) expect(current.keys).toContain(key);
    }
  });

  it("gives German its own ladder, not the English one plus umlauts", () => {
    const de = lessonsFor("de");
    const en = lessonsFor("en");
    expect(de.map((l) => l.focus)).not.toEqual(en.map((l) => l.focus));
    expect(de.some((l) => l.focus === "ß")).toBe(true);
    // z is an index-finger key in German and a bottom-row pinky key in English.
    expect(de.find((l) => l.focus === "tz")).toBeDefined();
    expect(en.find((l) => l.focus === "ty")).toBeDefined();
  });

  it("finds a rung by id and reports an unknown one as null", () => {
    expect(lessonById("en-1")?.focus).toBe("fj");
    expect(lessonById("en-999")).toBeNull();
  });
});

describe("drillFor", () => {
  it("only ever uses keys the rung has unlocked", () => {
    for (const lang of ["en", "de"] as const) {
      for (const lesson of lessonsFor(lang)) {
        const drill = drillFor(lesson, seededRandom(7));
        for (const ch of drill.replace(/ /g, "")) {
          expect(lesson.keys).toContain(ch);
        }
      }
    }
  });

  it("leans on the keys the rung is actually teaching", () => {
    const lesson = lessonsFor("en")[5];
    if (lesson === undefined) throw new Error("missing rung");
    const drill = drillFor(lesson, seededRandom(1)).replace(/ /g, "");
    const focused = Array.from(drill).filter((ch) => lesson.focus.includes(ch)).length;
    expect(focused / drill.length).toBeGreaterThan(0.4);
  });

  it("is deterministic for a given seed and varies without one", () => {
    const lesson = lessonsFor("en")[0];
    if (lesson === undefined) throw new Error("missing rung");
    expect(drillFor(lesson, seededRandom(42))).toBe(drillFor(lesson, seededRandom(42)));
    expect(drillFor(lesson, seededRandom(42))).not.toBe(drillFor(lesson, seededRandom(43)));
  });

  it("never repeats a letter three times running", () => {
    const lesson = lessonsFor("en")[0];
    if (lesson === undefined) throw new Error("missing rung");
    for (let seed = 0; seed < 40; seed += 1) {
      expect(drillFor(lesson, seededRandom(seed))).not.toMatch(/(.)\1\1/);
    }
  });
});
