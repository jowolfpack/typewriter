/**
 * Everything that survives a reload. `localStorage` only -- no account, no
 * server, nothing leaving the browser -- and every access wrapped, because
 * `localStorage` throws outright in some privacy modes and a setting is never
 * worth a crash.
 *
 * The exported surface is deliberately narrow (`profile()` / `saveProfile()`
 * plus the small settings object) so that adding sync later is one module and
 * not a hunt through the app for `localStorage` calls.
 */

import type { Lang } from "./layouts";

export type Theme = "dark" | "light";

/** One completed chunk or lesson. The history view is a list of these. */
export interface SessionRecord {
  /** Epoch milliseconds, so the chart needs no date parsing. */
  readonly at: number;
  readonly lang: Lang;
  readonly kind: "text" | "lesson";
  readonly title: string;
  readonly chars: number;
  readonly ms: number;
  readonly wpm: number;
  readonly accuracy: number;
}

/** A text the user dropped into the browser rather than into the repo. */
export interface ImportedText {
  readonly id: string;
  readonly title: string;
  readonly lang: Lang;
  readonly raw: string;
}

/**
 * Everything the export button writes out, and the import button reads back.
 * Mutable on purpose: `updateProfile()` hands one out as a draft to change.
 */
export interface Profile {
  version: 1;
  sessions: SessionRecord[];
  /** Expected character -> [attempts, misses]. An array to keep the JSON small. */
  keys: Record<string, [number, number]>;
  lessons: string[];
  /** Text id -> index of the next chunk. */
  positions: Record<string, number>;
  imported: ImportedText[];
}

const KEYS = {
  lang: "typewriter:lang",
  theme: "typewriter:theme",
  stats: "typewriter:stats",
  normalise: "typewriter:normalise",
  profile: "typewriter:profile",
} as const;

/** Oldest sessions fall off the end: a history is a habit, not an archive. */
const MAX_SESSIONS = 500;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Fall back rather than trust: a stale or hand-edited value must not stick. */
function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export const settings = {
  lang(): Lang {
    return oneOf(read(KEYS.lang), ["en", "de"] as const, "en");
  },
  setLang(value: Lang): void {
    write(KEYS.lang, value);
  },
  theme(): Theme {
    return oneOf(read(KEYS.theme), ["dark", "light"] as const, "dark");
  },
  setTheme(value: Theme): void {
    write(KEYS.theme, value);
  },
  /** Statistics are shown unless switched off. */
  stats(): boolean {
    return read(KEYS.stats) !== "off";
  },
  setStats(value: boolean): void {
    write(KEYS.stats, value ? "on" : "off");
  },
  /** Typography is rewritten unless switched off; see `text.ts` for why. */
  normalise(): boolean {
    return read(KEYS.normalise) !== "off";
  },
  setNormalise(value: boolean): void {
    write(KEYS.normalise, value ? "on" : "off");
  },
};

function emptyProfile(): Profile {
  return { version: 1, sessions: [], keys: {}, lessons: [], positions: {}, imported: [] };
}

/**
 * Parse a stored or imported profile, keeping only what is well formed. This is
 * load-bearing rather than tidy: the same function reads a file the user picked
 * off their disk, which may be anything at all.
 */
export function parseProfile(raw: string | null): Profile | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed["version"] !== 1) return null;

  const profile = emptyProfile();
  const sessions = parsed["sessions"];
  if (Array.isArray(sessions)) {
    for (const entry of sessions) {
      const record = asSession(entry);
      if (record !== null) profile.sessions.push(record);
    }
  }
  const keys = parsed["keys"];
  if (isRecord(keys)) {
    for (const [ch, pair] of Object.entries(keys)) {
      if (Array.isArray(pair) && typeof pair[0] === "number" && typeof pair[1] === "number") {
        profile.keys[ch] = [pair[0], pair[1]];
      }
    }
  }
  const lessons = parsed["lessons"];
  if (Array.isArray(lessons)) {
    for (const id of lessons) if (typeof id === "string") profile.lessons.push(id);
  }
  const positions = parsed["positions"];
  if (isRecord(positions)) {
    for (const [id, index] of Object.entries(positions)) {
      if (typeof index === "number" && Number.isFinite(index)) profile.positions[id] = index;
    }
  }
  const imported = parsed["imported"];
  if (Array.isArray(imported)) {
    for (const entry of imported) {
      const text = asImported(entry);
      if (text !== null) profile.imported.push(text);
    }
  }
  return profile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSession(value: unknown): SessionRecord | null {
  if (!isRecord(value)) return null;
  const at = value["at"];
  const lang = value["lang"];
  const kind = value["kind"];
  const title = value["title"];
  const chars = value["chars"];
  const ms = value["ms"];
  const wpm = value["wpm"];
  const accuracy = value["accuracy"];
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (lang !== "en" && lang !== "de") return null;
  if (kind !== "text" && kind !== "lesson") return null;
  if (typeof title !== "string") return null;
  if (typeof chars !== "number" || !Number.isFinite(chars)) return null;
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (typeof wpm !== "number" || !Number.isFinite(wpm)) return null;
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return null;
  return { at, lang, kind, title, chars, ms, wpm, accuracy };
}

function asImported(value: unknown): ImportedText | null {
  if (!isRecord(value)) return null;
  const id = value["id"];
  const title = value["title"];
  const lang = value["lang"];
  const raw = value["raw"];
  if (typeof id !== "string" || typeof title !== "string" || typeof raw !== "string") return null;
  if (lang !== "en" && lang !== "de") return null;
  return { id, title, lang, raw };
}

/** The stored profile, or an empty one. Never throws, never returns null. */
export function profile(): Profile {
  return parseProfile(read(KEYS.profile)) ?? emptyProfile();
}

export function saveProfile(value: Profile): void {
  write(KEYS.profile, JSON.stringify(value));
}

/** Read, change, write -- the only way the profile is ever updated. */
export function updateProfile(change: (draft: Profile) => void): Profile {
  const draft = profile();
  change(draft);
  saveProfile(draft);
  return draft;
}

/** Append a finished session and fold its key counts into the running tally. */
export function recordSession(
  record: SessionRecord,
  keys: ReadonlyMap<string, { attempts: number; misses: number }>,
): void {
  updateProfile((draft) => {
    draft.sessions.push(record);
    if (draft.sessions.length > MAX_SESSIONS) {
      draft.sessions.splice(0, draft.sessions.length - MAX_SESSIONS);
    }
    for (const [ch, count] of keys) {
      const existing = draft.keys[ch] ?? [0, 0];
      draft.keys[ch] = [existing[0] + count.attempts, existing[1] + count.misses];
    }
  });
}

/** Pretty-printed, because the export is a file a person may well open. */
export function exportProfile(): string {
  return JSON.stringify(profile(), null, 2);
}

/**
 * Replace the stored profile from a file. Returns a message for the UI rather
 * than throwing: a bad file is a thing the user did, not a bug.
 */
export function importProfile(raw: string): { ok: boolean; message: string } {
  const parsed = parseProfile(raw);
  if (parsed === null) return { ok: false, message: "That is not a Typewriter export." };
  saveProfile(parsed);
  const count = parsed.sessions.length;
  return { ok: true, message: `Imported ${count} session${count === 1 ? "" : "s"}.` };
}
