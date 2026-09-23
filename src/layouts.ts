/**
 * Which finger presses which key, for both layouts.
 *
 * The browser cannot read your physical keyboard, so the language switch is the
 * user telling us -- and it has to be right, because a German text typed on a
 * US layout is unusable. This table is read twice: the lesson ladder builds its
 * rungs from it, and the statistics turn missed keys into missed fingers.
 */

export type Lang = "en" | "de";

export type Finger =
  | "left pinky"
  | "left ring"
  | "left middle"
  | "left index"
  | "right index"
  | "right middle"
  | "right ring"
  | "right pinky"
  | "thumb";

/** Each entry is a finger and every character it is responsible for. */
type Assignment = ReadonlyArray<readonly [Finger, string]>;

const QWERTY_US: Assignment = [
  ["left pinky", "qaz1!`~QAZ"],
  ["left ring", "wsx2@WSX"],
  ["left middle", "edc3#EDC"],
  ["left index", "rfvtgb45$%RFVTGB"],
  ["right index", "yhnujm67^&YHNUJM"],
  ["right middle", "ik,8*<IK"],
  ["right ring", "ol.9(>OL"],
  ["right pinky", "p;/0-=[]\'\"P:?)_+{}|"],
  ["thumb", " "],
];

/**
 * QWERTZ is not QWERTY with two extra letters: y and z trade places, the
 * umlauts take the keys ;'[ hold on a US board, and most punctuation moves.
 * Writing it out in full is the only way the finger answers stay true.
 */
const QWERTZ_DE: Assignment = [
  ["left pinky", "qay1!^°<>|QAY"],
  ["left ring", "wsx2\"WSX"],
  ["left middle", "edc3§EDC"],
  ["left index", "rfvtgb45$%RFVTGB"],
  ["right index", "zhnujm67&/ZHNUJM"],
  ["right middle", "ik,8(IK;"],
  ["right ring", "ol.9)OL:"],
  ["right pinky", "püöäß0´`+*#'-_=?PÜÖÄ"],
  ["thumb", " "],
];

const LAYOUTS: Readonly<Record<Lang, Assignment>> = { en: QWERTY_US, de: QWERTZ_DE };

/** Built once per layout: character -> finger. */
const INDEX: Readonly<Record<Lang, ReadonlyMap<string, Finger>>> = {
  en: buildIndex(QWERTY_US),
  de: buildIndex(QWERTZ_DE),
};

function buildIndex(assignment: Assignment): ReadonlyMap<string, Finger> {
  const map = new Map<string, Finger>();
  for (const [finger, keys] of assignment) {
    // First assignment wins, so a character listed twice by mistake is stable
    // rather than depending on row order.
    for (const key of keys) if (!map.has(key)) map.set(key, finger);
  }
  return map;
}

/** The finger for a character, or null for anything off the layout. */
export function fingerFor(lang: Lang, ch: string): Finger | null {
  return INDEX[lang].get(ch) ?? null;
}

/** Every finger in hand order, for a stable display. */
export const FINGERS: readonly Finger[] = [
  "left pinky",
  "left ring",
  "left middle",
  "left index",
  "thumb",
  "right index",
  "right middle",
  "right ring",
  "right pinky",
];

/** Human name of a layout, for the one place the UI mentions it. */
export function layoutName(lang: Lang): string {
  return lang === "de" ? "QWERTZ (German)" : "QWERTY (US)";
}

export { LAYOUTS };
