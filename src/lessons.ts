/**
 * The beginner ladder: pure, generated, and different per layout.
 *
 * Drill text is generated rather than stored so a lesson never becomes a thing
 * you memorise the order of -- the same reason the StateLearner drill reshuffles
 * on every attempt. The rng is injectable so the tests are deterministic.
 */

import type { Lang } from "./layouts";

/** One rung. `keys` is everything allowed; `focus` is what this rung adds. */
export interface Lesson {
  readonly id: string;
  readonly name: string;
  readonly focus: string;
  readonly keys: string;
}

/** Words per generated drill. Long enough to settle into, short enough to end. */
const WORDS = 28;

/**
 * Rungs as [name, newly added keys]. Each inherits everything above it, which
 * is built up in `ladder()` -- restating the full key set per rung is how the
 * two layouts would silently drift apart.
 */
const EN_STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Home keys f and j", "fj"],
  ["d and k", "dk"],
  ["s and l", "sl"],
  ["a and semicolon", "a;"],
  ["The index reaches: g and h", "gh"],
  ["e and i", "ei"],
  ["r and u", "ru"],
  ["t and y", "ty"],
  ["w and o", "wo"],
  ["q and p", "qp"],
  ["v and m", "vm"],
  ["c and comma", "c,"],
  ["x and period", "x."],
  ["z and slash", "z/"],
  ["b and n", "bn"],
  ["Capitals", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
  ["Punctuation", "'\"?!:-"],
  ["Numbers", "1234567890"],
];

const DE_STEPS: ReadonlyArray<readonly [string, string]> = [
  ["Grundstellung f und j", "fj"],
  ["d und k", "dk"],
  ["s und l", "sl"],
  ["a und ö", "aö"],
  ["Zeigefinger: g und h", "gh"],
  ["e und i", "ei"],
  ["r und u", "ru"],
  ["t und z", "tz"],
  ["w und o", "wo"],
  ["q und p", "qp"],
  ["v und m", "vm"],
  ["c und Komma", "c,"],
  ["x und Punkt", "x."],
  ["y und Bindestrich", "y-"],
  ["b und n", "bn"],
  ["ä und ü", "äü"],
  ["ß", "ß"],
  ["Großbuchstaben", "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"],
  ["Satzzeichen", "'\"?!:-"],
  ["Ziffern", "1234567890"],
];

function ladder(steps: ReadonlyArray<readonly [string, string]>, lang: Lang): Lesson[] {
  let carried = "";
  return steps.map(([name, focus], index) => {
    carried += focus;
    return { id: `${lang}-${index + 1}`, name, focus, keys: carried };
  });
}

const LADDERS: Readonly<Record<Lang, Lesson[]>> = {
  en: ladder(EN_STEPS, "en"),
  de: ladder(DE_STEPS, "de"),
};

/** The whole ladder for a language, easiest first. */
export function lessonsFor(lang: Lang): readonly Lesson[] {
  return LADDERS[lang];
}

/** One rung by id, or null -- ids come out of storage and may be stale. */
export function lessonById(id: string): Lesson | null {
  for (const lang of ["en", "de"] as const) {
    const found = LADDERS[lang].find((lesson) => lesson.id === id);
    if (found !== undefined) return found;
  }
  return null;
}

/** mulberry32: small, seedable, and good enough to shuffle letters with. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a drill for one rung. New keys are over-represented, because a rung
 * that merely *allows* its new letters is a rung you can pass without learning
 * them, and no letter repeats three times running -- "fff" trains nothing.
 */
export function drillFor(lesson: Lesson, rng: () => number = Math.random): string {
  const focus = Array.from(lesson.focus);
  const all = Array.from(lesson.keys);
  const words: string[] = [];

  for (let w = 0; w < WORDS; w += 1) {
    const length = 2 + Math.floor(rng() * 4);
    let word = "";
    for (let i = 0; i < length; i += 1) {
      const pool = rng() < 0.55 ? focus : all;
      let ch = pool[Math.floor(rng() * pool.length)] ?? all[0] ?? "f";
      if (word.length >= 2 && word.endsWith(ch.repeat(2))) {
        // Re-rolling could land on the same letter again, so pick from a pool
        // that cannot: the whole point is that the third one is impossible.
        const others = all.filter((other) => other !== ch);
        ch = others[Math.floor(rng() * others.length)] ?? ch;
      }
      word += ch;
    }
    words.push(word);
  }

  return words.join(" ");
}
