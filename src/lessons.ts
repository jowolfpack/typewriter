/**
 * The beginner ladder: pure, generated, and different per layout.
 *
 * Drill text is generated rather than stored so a lesson never becomes a thing
 * you memorise the order of -- the same reason the StateLearner drill reshuffles
 * on every attempt. The rng is injectable so the tests are deterministic.
 */

import type { Lang } from "./layouts";
import { wordsWithin } from "./words";

/** One rung. `keys` is everything allowed; `focus` is what this rung adds. */
export interface Lesson {
  readonly id: string;
  readonly name: string;
  readonly focus: string;
  readonly keys: string;
  readonly lang: Lang;
}

/** Below this many spellable words, a rung is still all syllables. */
const ENOUGH_WORDS = 8;

/** Share of a drill made of real words, once there are enough to draw on. */
const WORD_SHARE = 0.6;

/** Items per generated drill. Long enough to settle into, short enough to end. */
const ITEMS = 28;

/**
 * Rungs as [name, newly added keys]. Each inherits everything above it, which
 * is built up in `ladder()` -- restating the full key set per rung is how the
 * two layouts would silently drift apart.
 *
 * The names stay English in both ladders: the language switch changes the
 * keyboard and the text, never the interface.
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
  ["Home keys f and j", "fj"],
  ["d and k", "dk"],
  ["s and l", "sl"],
  ["a and ö", "aö"],
  ["The index reaches: g and h", "gh"],
  ["e and i", "ei"],
  ["r and u", "ru"],
  ["t and z", "tz"],
  ["w and o", "wo"],
  ["q and p", "qp"],
  ["v and m", "vm"],
  ["c and comma", "c,"],
  ["x and period", "x."],
  ["y and hyphen", "y-"],
  ["b and n", "bn"],
  ["ä and ü", "äü"],
  ["ß", "ß"],
  ["Capitals", "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"],
  ["Punctuation", "'\"?!:-"],
  ["Numbers", "1234567890"],
];

function ladder(steps: ReadonlyArray<readonly [string, string]>, lang: Lang): Lesson[] {
  let carried = "";
  return steps.map(([name, focus], index) => {
    carried += focus;
    return { id: `${lang}-${index + 1}`, name, focus, keys: carried, lang };
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
 * Build a drill for one rung.
 *
 * Early rungs have too few letters to spell anything, so they are syllables:
 * new keys over-represented, because a rung that merely *allows* its new
 * letters is one you can pass without learning them, and no letter three times
 * running, since "fff" trains nothing.
 *
 * Once enough words are spellable the drill becomes mostly words, which is
 * where the real skill is -- letter pairs, rhythm, and something your hands can
 * carry over to actual text.
 */
export function drillFor(lesson: Lesson, rng: () => number = Math.random): string {
  const pool = wordsWithin(lesson.lang, lesson.keys);
  const useWords = pool.length >= ENOUGH_WORDS;
  const items: string[] = [];

  for (let i = 0; i < ITEMS; i += 1) {
    if (useWords && rng() < WORD_SHARE) items.push(decorate(pickWord(pool, rng), lesson, rng));
    else items.push(syllable(lesson, rng));
  }

  return items.join(" ");
}

function pickWord(pool: readonly string[], rng: () => number): string {
  return pool[Math.floor(rng() * pool.length)] ?? "";
}

/**
 * A rung teaching capitals or punctuation has to practise them on something.
 * Sticking them onto real words is closer to writing than a row of loose marks.
 */
function decorate(word: string, lesson: Lesson, rng: () => number): string {
  const capitals = Array.from(lesson.focus).filter((ch) => ch !== ch.toLowerCase());
  const marks = Array.from(lesson.focus).filter((ch) => /[^\p{L}\p{N}]/u.test(ch));
  let out = word;
  if (capitals.length > 0 && rng() < 0.7) out = out.charAt(0).toUpperCase() + out.slice(1);
  if (marks.length > 0 && rng() < 0.6) out += marks[Math.floor(rng() * marks.length)] ?? "";
  return out;
}

function syllable(lesson: Lesson, rng: () => number): string {
  const focus = Array.from(lesson.focus);
  const all = Array.from(lesson.keys);
  const length = 2 + Math.floor(rng() * 4);
  let word = "";
  for (let i = 0; i < length; i += 1) {
    const source = rng() < 0.55 ? focus : all;
    let ch = source[Math.floor(rng() * source.length)] ?? all[0] ?? "f";
    if (word.length >= 2 && word.endsWith(ch.repeat(2))) {
      // Re-rolling could land on the same letter again, so pick from a pool
      // that cannot: the whole point is that the third one is impossible.
      const others = all.filter((other) => other !== ch);
      ch = others[Math.floor(rng() * others.length)] ?? ch;
    }
    word += ch;
  }
  return word;
}
