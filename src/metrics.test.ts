import { describe, expect, it } from "vitest";
import { Metrics } from "./metrics";

/** A clock the test moves by hand. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 0;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

describe("Metrics", () => {
  it("counts a clean run as perfect", () => {
    const metrics = new Metrics(() => 0);
    metrics.record(0, "a", true);
    metrics.record(1, "b", true);
    expect(metrics.snapshot().accuracy).toBe(1);
    expect(metrics.snapshot().errors).toBe(0);
  });

  it("still counts a miss after it has been fixed", () => {
    const metrics = new Metrics(() => 0);
    metrics.record(0, "a", false);
    metrics.recordBackspace();
    metrics.record(0, "a", true);
    const snap = metrics.snapshot();
    expect(snap.errors).toBe(1);
    expect(snap.correct).toBe(0);
    expect(metrics.keyCounts().get("a")).toEqual({ attempts: 1, misses: 1 });
  });

  it("charges the miss to the key that was wanted", () => {
    const metrics = new Metrics(() => 0);
    metrics.record(0, "ö", false);
    metrics.record(1, "ö", true);
    expect(metrics.keyCounts().get("ö")).toEqual({ attempts: 2, misses: 1 });
  });

  it("caps an idle gap instead of counting the whole pause", () => {
    const clock = fakeClock();
    const metrics = new Metrics(clock.now);
    metrics.record(0, "a", true);
    clock.advance(60_000);
    metrics.record(1, "b", true);
    expect(metrics.elapsedMs()).toBe(3000);
  });

  it("counts a normal gap in full", () => {
    const clock = fakeClock();
    const metrics = new Metrics(clock.now);
    metrics.record(0, "a", true);
    clock.advance(120);
    metrics.record(1, "b", true);
    expect(metrics.elapsedMs()).toBe(120);
  });

  it("computes wpm from correct characters over elapsed minutes", () => {
    const clock = fakeClock();
    const metrics = new Metrics(clock.now);
    // 25 correct characters typed at a steady 100ms each: 24 gaps = 2.4s.
    for (let i = 0; i < 25; i += 1) {
      metrics.record(i, "a", true);
      if (i < 24) clock.advance(100);
    }
    const snap = metrics.snapshot();
    expect(snap.ms).toBe(2400);
    expect(Math.round(snap.wpm)).toBe(125);
  });

  it("reads as zero before the first keystroke", () => {
    const metrics = new Metrics(() => 0);
    expect(metrics.elapsedMs()).toBe(0);
    expect(metrics.snapshot().wpm).toBe(0);
  });

  it("counts a hinted position as a miss that typing it cannot undo", () => {
    const metrics = new Metrics(() => 0);
    metrics.recordHint([0, 1]);
    metrics.record(0, "a", true);
    metrics.record(1, "b", true);
    metrics.record(2, "c", true);
    const snap = metrics.snapshot();
    expect(snap.errors).toBe(2);
    expect(snap.hints).toBe(2);
    expect(snap.correct).toBe(1);
    // A forgotten word is not a weak key.
    expect(metrics.keyCounts().has("a")).toBe(false);
  });
});
