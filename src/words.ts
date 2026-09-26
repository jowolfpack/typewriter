/**
 * Common words, used to make the later lesson rungs worth typing.
 *
 * A ladder made only of random syllables trains the keys and nothing else --
 * no letter pairs you will ever meet again, no rhythm. Once a rung has unlocked
 * enough letters, `lessons.ts` fills part of the drill with real words that
 * happen to be spellable from those letters.
 *
 * These are ordinary high-frequency words, not quotations: short, unremarkable,
 * and safe to write out. Keep them lowercase and unpunctuated -- the generator
 * adds capitals and punctuation itself when a rung is teaching them.
 */

import type { Lang } from "./layouts";

const EN = `the and for are but not you all any can had her was one our out day get has him
his how man new now old see two way who boy did its let put say she too use dad mom
that with have this will your from they know want been good much some time very when come
here just like long make many over such take than them well were what word work year
back call came each even find give hand high keep kind last left life line live look
made most move must name need next open part play read real room seem show side tell
turn walk week went wish`
  .split(/\s+/)
  .filter((word) => word !== "");

const DE = `der die das und ist ein eine den dem des mit auf für von zu im am an als auch
aus bei bis dann doch dort durch einen einer etwas fast ganz gar gegen gern gibt hat hier
ich ihm ihn ihr immer ja jede jetzt kann kaum kein lang mehr mein mich mir muss nach nein
nicht noch nun nur oder ohne schon sehr sein seit sich sie sind so über um uns
unter viel vom vor war wenn wer wie wieder wir wird wo zum zur zwei drei vier fünf haus
hand kind jahr tag welt weg zeit mann frau buch tür weit gut alt neu groß klein schön
lesen sagen gehen sehen stehen kommen geben nehmen halten leben spielen warten fragen
denken finden bleiben laufen tragen schlafen öffnen hören können müssen wollen dürfen`
  .split(/\s+/)
  .filter((word) => word !== "");

const LISTS: Readonly<Record<Lang, readonly string[]>> = { en: EN, de: DE };

/**
 * Every word spellable using only `keys`. Returns them in list order, so a
 * given rung always draws from the same pool and the seeded rng stays the only
 * source of variation.
 */
export function wordsWithin(lang: Lang, keys: string): string[] {
  const allowed = new Set(Array.from(keys));
  return LISTS[lang].filter((word) => Array.from(word).every((ch) => allowed.has(ch)));
}
