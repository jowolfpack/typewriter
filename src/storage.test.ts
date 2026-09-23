/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  exportProfile,
  importProfile,
  parseProfile,
  profile,
  recordSession,
  settings,
  updateProfile,
} from "./storage";
import type { SessionRecord } from "./storage";

const SESSION: SessionRecord = {
  at: 1_700_000_000_000,
  lang: "de",
  kind: "text",
  title: "Die Verwandlung",
  chars: 300,
  ms: 60_000,
  wpm: 60,
  accuracy: 0.97,
};

beforeEach(() => {
  localStorage.clear();
});

describe("settings", () => {
  it("defaults to English, dark, stats on, normalising on", () => {
    expect(settings.lang()).toBe("en");
    expect(settings.theme()).toBe("dark");
    expect(settings.stats()).toBe(true);
    expect(settings.normalise()).toBe(true);
  });

  it("falls back when a stored value is no longer valid", () => {
    localStorage.setItem("typewriter:lang", "fr");
    localStorage.setItem("typewriter:theme", "system");
    expect(settings.lang()).toBe("en");
    expect(settings.theme()).toBe("dark");
  });

  it("round-trips a change", () => {
    settings.setLang("de");
    settings.setStats(false);
    expect(settings.lang()).toBe("de");
    expect(settings.stats()).toBe(false);
  });
});

describe("profile", () => {
  it("starts empty", () => {
    expect(profile().sessions).toEqual([]);
  });

  it("accumulates key counts across sessions", () => {
    const keys = new Map([["ö", { attempts: 10, misses: 3 }]]);
    recordSession(SESSION, keys);
    recordSession(SESSION, keys);
    expect(profile().keys["ö"]).toEqual([20, 6]);
    expect(profile().sessions).toHaveLength(2);
  });

  it("keeps only the most recent 500 sessions", () => {
    updateProfile((draft) => {
      for (let i = 0; i < 520; i += 1) draft.sessions.push({ ...SESSION, at: i });
    });
    recordSession({ ...SESSION, at: 999 }, new Map());
    const stored = profile().sessions;
    expect(stored).toHaveLength(500);
    expect(stored[stored.length - 1]?.at).toBe(999);
  });
});

describe("export and import", () => {
  it("round-trips a profile", () => {
    recordSession(SESSION, new Map([["a", { attempts: 4, misses: 1 }]]));
    const exported = exportProfile();
    localStorage.clear();
    expect(importProfile(exported)).toEqual({ ok: true, message: "Imported 1 session." });
    expect(profile().keys["a"]).toEqual([4, 1]);
  });

  it("rejects a file that is not an export, without throwing", () => {
    expect(importProfile("not json at all").ok).toBe(false);
    expect(importProfile(JSON.stringify({ version: 99 })).ok).toBe(false);
    expect(importProfile("[]").ok).toBe(false);
  });

  it("drops malformed rows instead of the whole file", () => {
    const parsed = parseProfile(
      JSON.stringify({
        version: 1,
        sessions: [SESSION, { at: "yesterday" }, { ...SESSION, lang: "fr" }],
        keys: { a: [1, 0], b: "nonsense" },
        lessons: ["en-1", 7],
        positions: { book: 3, other: "far" },
      }),
    );
    expect(parsed?.sessions).toHaveLength(1);
    expect(parsed?.keys).toEqual({ a: [1, 0] });
    expect(parsed?.lessons).toEqual(["en-1"]);
    expect(parsed?.positions).toEqual({ book: 3 });
  });

  it("survives a corrupt stored profile", () => {
    localStorage.setItem("typewriter:profile", "{oh no");
    expect(profile().sessions).toEqual([]);
  });
});
