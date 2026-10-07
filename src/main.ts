import "./style.css";
import { TrendChart, accuracyDomain } from "./chart";
import { libraryFor, titleFromPath, type TextEntry } from "./library";
import { fingerFor, layoutName, type Finger, type Lang } from "./layouts";
import { drillFor, lessonsFor, type Lesson } from "./lessons";
import { Metrics, type Snapshot } from "./metrics";
import {
  exportProfile,
  importProfile,
  profile,
  recordSession,
  settings,
  updateProfile,
} from "./storage";
import type { Theme } from "./storage";
import { TypeLine } from "./stream";
import { VerseLines } from "./verse";
import { clean, extractHeader, prepare } from "./text";
import { applyTheme, initTheme } from "./theme";
import { TypingSession } from "./typing";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing element #${id}`);
  return node as T;
}

const ui = {
  back: el<HTMLButtonElement>("back"),
  title: el("title"),
  lang: el<HTMLSelectElement>("lang"),
  theme: el<HTMLSelectElement>("theme"),
  statsToggle: el<HTMLInputElement>("stats-toggle"),
  historyLink: el<HTMLButtonElement>("history-link"),

  home: el("home"),
  textList: el<HTMLUListElement>("text-list"),
  libraryHint: el("library-hint"),
  importText: el<HTMLButtonElement>("import-text"),
  textFile: el<HTMLInputElement>("text-file"),
  layoutName: el("layout-name"),
  lessonList: el<HTMLUListElement>("lesson-list"),

  type: el("type"),
  streamSlot: el("stream-slot"),
  typingMeta: el("typing-meta"),
  typeHint: el("type-hint"),
  capture: el<HTMLInputElement>("capture"),

  done: el("done"),
  doneTitle: el("done-title"),
  summary: el("summary"),
  doneDetail: el("done-detail"),
  nextChunk: el<HTMLButtonElement>("next-chunk"),
  again: el<HTMLButtonElement>("again"),
  toLibrary: el<HTMLButtonElement>("to-library"),

  history: el("history"),
  charts: el("charts"),
  weakKeys: el<HTMLUListElement>("weak-keys"),
  weakSummary: el("weak-summary"),
  sessionList: el<HTMLUListElement>("session-list"),
  exportButton: el<HTMLButtonElement>("export"),
  importButton: el<HTMLButtonElement>("import"),
  profileFile: el<HTMLInputElement>("profile-file"),
  profileFeedback: el("profile-feedback"),
};

type View = "home" | "type" | "done" | "history";

/**
 * What is being typed. A text carries its chunks and where in them we are; a
 * lesson is generated fresh each time, so there is nothing to remember.
 */
type Activity =
  | { kind: "text"; entry: TextEntry; chunks: string[]; index: number; byHeart: boolean }
  | { kind: "lesson"; lesson: Lesson };

/** A browser-held text over this size belongs in the repo folder instead. */
const MAX_IMPORT_BYTES = 300_000;

/** Accuracy that marks a lesson as cleared. Nothing is ever locked. */
const LESSON_PASS = 0.97;

let view: View = "home";
let lang: Lang = settings.lang();
let activity: Activity | null = null;
let session: TypingSession | null = null;
let metrics: Metrics | null = null;
let finished: Snapshot | null = null;

const strip = new TypeLine();
const verse = new VerseLines();
/**
 * Which of the two is on screen. A part with line breaks in it is verse -- or
 * prose whose lines the reader chose to keep -- and gets rows; everything else,
 * drills included, gets the scrolling strip.
 */
let line: TypeLine | VerseLines = strip;

const wpmChart = new TrendChart({
  label: "Words per minute",
  colorToken: "--accent",
  format: (value) => `${Math.round(value)} wpm`,
});

const accuracyChart = new TrendChart({
  label: "Accuracy",
  colorToken: "--ok",
  format: (value) => `${(value * 100).toFixed(1)}%`,
  domain: accuracyDomain,
});

// -- Rendering ----------------------------------------------------------

function render(): void {
  ui.home.hidden = view !== "home";
  ui.type.hidden = view !== "type";
  ui.done.hidden = view !== "done";
  ui.history.hidden = view !== "history";
  ui.back.hidden = view === "home";

  ui.title.textContent =
    view === "home" ? "Typewriter" : view === "history" ? "History" : activityTitle();

  if (view === "home") renderHome();
  else if (view === "type") renderTyping();
  else if (view === "done") renderDone();
  else renderHistory();
}

function renderHome(): void {
  const stored = profile();
  const texts = libraryFor(lang, stored.imported);

  ui.textList.replaceChildren(
    ...texts.map((entry) => {
      const position = stored.positions[entry.id] ?? 0;
      const joined = stored.joined[entry.id] ?? false;
      const prepared = entry.broken ? null : prepare(entry.raw, joined);
      const parts = prepared?.chunks.length ?? 0;
      const note = entry.broken
        ? "not UTF-8"
        : prepared?.verse === true
          ? `${verseLines(prepared.chunks[0] ?? "")} lines`
          : position > 0
            ? `part ${position + 1} of ${parts}`
            : `${parts} parts`;
      const row = entryRow(entry.title, note, entry.broken, () => startText(entry));
      if (prepared?.verse === true) row.append(byHeartButton(entry));
      if (prepared?.wrapped === true) row.append(linesButton(entry.id, joined));
      if (entry.link !== null) row.append(sourceLink(entry.link));
      if (entry.source === "imported") row.append(removeButton(entry));
      return row;
    }),
  );

  ui.libraryHint.textContent =
    texts.length === 0
      ? `No ${lang === "de" ? "German" : "English"} texts yet. Drop a .txt file here, or put one in texts/${lang}/.`
      : "Drop a .txt file anywhere on this page to add one just for this browser.";

  ui.layoutName.textContent = layoutName(lang);
  ui.lessonList.replaceChildren(
    ...lessonsFor(lang).map((lesson) => {
      const done = stored.lessons.includes(lesson.id);
      const row = entryRow(lesson.name, lesson.focus.slice(0, 12), false, () =>
        startLesson(lesson),
      );
      if (done) row.firstElementChild?.classList.add("is-done");
      return row;
    }),
  );
}

function entryRow(
  name: string,
  note: string,
  disabled: boolean,
  onPick: () => void,
): HTMLLIElement {
  const label = document.createElement("span");
  label.className = "entry-name";
  label.textContent = name;

  const detail = document.createElement("span");
  detail.className = "entry-note";
  detail.textContent = note;

  const button = document.createElement("button");
  button.type = "button";
  button.className = disabled ? "entry is-broken" : "entry";
  button.disabled = disabled;
  button.append(label, detail);
  button.addEventListener("click", onPick);

  const row = document.createElement("li");
  row.className = "entry-row";
  row.append(button);
  return row;
}

/** Verse lines in a poem, not counting the blank lines between stanzas. */
function verseLines(text: string): number {
  return text.split("\n").filter((row) => row !== "").length;
}

/**
 * Where the text was taken from. A copy can be wrong, and a wrong word is one
 * you practise a hundred times, so the edition is one click away.
 */
function sourceLink(url: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "entry-aside entry-source";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "source";
  link.title = url;
  return link;
}

/**
 * Learn a poem by heart: the same text with nothing ahead of the caret shown.
 * Offered for verse only, where the lines give the hidden text a shape to
 * remember it by.
 */
function byHeartButton(entry: TextEntry): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "entry-aside secondary";
  button.textContent = "by heart";
  button.title =
    "Type it without seeing it. Punctuation may be left out; Tab shows the next word.";
  button.addEventListener("click", () => startText(entry, true));
  return button;
}

/**
 * Offered only when a file looks hard-wrapped at a margin. The guess is never
 * applied on its own: joining a poem would destroy its lineation, so the choice
 * is the reader's and it is visible on the row.
 */
function linesButton(id: string, joined: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "entry-aside secondary";
  button.textContent = joined ? "lines joined" : "lines as in file";
  button.title =
    "This file looks wrapped at a margin. Joining puts each paragraph back " +
    "together; leaving it types the line breaks the file actually has.";
  button.addEventListener("click", () => {
    updateProfile((draft) => {
      draft.joined[id] = !joined;
      // The chunks are different now, so a saved position points elsewhere.
      delete draft.positions[id];
    });
    render();
  });
  return button;
}

function removeButton(entry: TextEntry): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "entry-remove secondary";
  button.textContent = "×";
  button.title = `Remove ${entry.title} from this browser`;
  button.addEventListener("click", () => {
    updateProfile((draft) => {
      draft.imported = draft.imported.filter((text) => text.id !== entry.id);
    });
    render();
  });
  return button;
}

function renderTyping(): void {
  ui.typingMeta.hidden = !settings.stats();
  if (session !== null) line.update(session);
  renderMeta();
  renderHint();
}

function renderMeta(): void {
  if (metrics === null || session === null) return;
  const snap = metrics.snapshot();
  const byHeart = activity?.kind === "text" && activity.byHeart;
  const where =
    activity?.kind !== "text"
      ? "drill"
      : line === verse && activity.chunks.length === 1
        ? `line ${verseLines(session.target.slice(0, session.cursor + 1))} of ${verseLines(session.target)}`
        : `part ${activity.index + 1} of ${activity.chunks.length}`;
  ui.typingMeta.replaceChildren(
    ...[
      `${Math.round(snap.wpm)} wpm`,
      `${(snap.accuracy * 100).toFixed(0)}%`,
      `${snap.errors} ${snap.errors === 1 ? "error" : "errors"}`,
      ...(byHeart ? [`${snap.hints} hinted`] : []),
      formatDuration(snap.ms),
      where,
    ].map((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      return span;
    }),
  );
}

let capsLock = false;

function renderHint(): void {
  if (capsLock) {
    ui.typeHint.textContent = "Caps Lock is on.";
    return;
  }
  if (document.activeElement !== ui.capture) {
    ui.typeHint.textContent = "Click the line to keep typing.";
    return;
  }
  ui.typeHint.textContent =
    session?.isError === true
      ? "Delete back to the mistake to carry on."
      : activity?.kind === "text" && activity.byHeart
        ? "Tab shows the next word. Esc returns to the library."
        : "Esc returns to the library.";
}

function renderDone(): void {
  if (finished === null) return;
  const more = activity?.kind === "text" && activity.index + 1 < activity.chunks.length;
  ui.doneTitle.textContent =
    activity?.kind === "lesson"
      ? "Drill finished"
      : activity?.chunks.length === 1
        ? "Finished"
        : "Part finished";
  ui.summary.textContent = `${Math.round(finished.wpm)} wpm · ${(finished.accuracy * 100).toFixed(1)}%`;
  const hinted =
    finished.hints > 0 ? ` ${finished.hints} of those were shown by a hint.` : "";
  ui.doneDetail.textContent = `${finished.correct + finished.errors} characters in ${formatDuration(finished.ms)}, ${finished.errors} of them wrong the first time.${hinted}`;
  ui.nextChunk.hidden = !more && activity?.kind === "text";
  ui.nextChunk.textContent = activity?.kind === "lesson" ? "New drill" : "Continue";
}

function renderHistory(): void {
  const stored = profile();
  const sessions = stored.sessions;

  wpmChart.update(sessions.map((record) => ({ at: record.at, value: record.wpm })));
  accuracyChart.update(sessions.map((record) => ({ at: record.at, value: record.accuracy })));

  const rows = Object.entries(stored.keys)
    .map(([ch, [attempts, misses]]) => ({ ch, attempts, misses, rate: misses / attempts }))
    // Under ten attempts a "50% miss rate" is one slip and says nothing.
    .filter((row) => row.attempts >= 10 && row.misses > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  ui.weakKeys.replaceChildren(
    ...rows.map((row) => {
      const name = document.createElement("span");
      name.className = "key-name";
      name.textContent = row.ch === " " ? "space" : row.ch;

      const detail = document.createElement("span");
      detail.className = "key-detail";
      const finger = fingerFor(lang, row.ch);
      detail.textContent = `${(row.rate * 100).toFixed(0)}% of ${row.attempts}${finger === null ? "" : ` · ${finger}`}`;

      const item = document.createElement("li");
      item.className = "key-row";
      item.append(name, detail);
      return item;
    }),
  );

  ui.weakSummary.textContent =
    rows.length === 0
      ? "Nothing stands out yet. Type a few hundred characters and the weak keys will show up here."
      : weakestFinger(stored.keys);

  ui.sessionList.replaceChildren(
    ...[...sessions]
      .slice(-12)
      .reverse()
      .map((record) => {
        const name = document.createElement("span");
        name.textContent = record.title;

        const detail = document.createElement("span");
        detail.className = "session-detail";
        detail.textContent = `${Math.round(record.wpm)} wpm · ${(record.accuracy * 100).toFixed(0)}% · ${new Date(record.at).toLocaleDateString()}`;

        const item = document.createElement("li");
        item.className = "session-row";
        item.append(name, detail);
        return item;
      }),
  );
}

/** Roll the per-key counts up to fingers, which is the more actionable answer. */
function weakestFinger(keys: Record<string, [number, number]>): string {
  const totals = new Map<Finger, { attempts: number; misses: number }>();
  for (const [ch, [attempts, misses]] of Object.entries(keys)) {
    const finger = fingerFor(lang, ch);
    if (finger === null) continue;
    const running = totals.get(finger) ?? { attempts: 0, misses: 0 };
    running.attempts += attempts;
    running.misses += misses;
    totals.set(finger, running);
  }
  let worst: { finger: Finger; rate: number } | null = null;
  for (const [finger, count] of totals) {
    if (count.attempts < 50) continue;
    const rate = count.misses / count.attempts;
    if (worst === null || rate > worst.rate) worst = { finger, rate };
  }
  if (worst === null) return "Not enough typed yet to blame a finger.";
  return `Your ${worst.finger} misses most often, on ${(worst.rate * 100).toFixed(1)}% of its keys.`;
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function activityTitle(): string {
  if (activity === null) return "Typewriter";
  if (activity.kind === "lesson") return activity.lesson.name;
  return activity.byHeart ? `${activity.entry.title} · by heart` : activity.entry.title;
}

// -- Flow ---------------------------------------------------------------

function startText(entry: TextEntry, byHeart = false): void {
  const { chunks } = prepare(entry.raw, profile().joined[entry.id] ?? false);
  if (chunks.length === 0) return;
  const stored = profile().positions[entry.id] ?? 0;
  // A saved position can outlive the text it points into -- the file may have
  // been edited since, or normalising switched off and changed the chunking.
  const index = stored >= 0 && stored < chunks.length ? stored : 0;
  activity = { kind: "text", entry, chunks, index, byHeart };
  begin();
}

function startLesson(lesson: Lesson): void {
  activity = { kind: "lesson", lesson };
  begin();
}

function begin(): void {
  if (activity === null) return;
  const text =
    activity.kind === "text" ? (activity.chunks[activity.index] ?? "") : drillFor(activity.lesson);
  const byHeart = activity.kind === "text" && activity.byHeart;
  session = new TypingSession(text, { optionalPunctuation: byHeart });
  metrics = new Metrics();
  finished = null;
  view = "type";
  line = text.includes("\n") ? verse : strip;
  ui.streamSlot.replaceChildren(line.element);
  render();
  if (line === verse && activity.kind === "text") {
    verse.reset(
      session,
      {
        // By heart, the neighbouring parts would give the game away.
        before: byHeart ? "" : (activity.chunks[activity.index - 1] ?? ""),
        after: byHeart ? "" : (activity.chunks[activity.index + 1] ?? ""),
      },
      byHeart,
    );
  } else {
    line.reset(session);
  }
  focusCapture();
}

function typeChar(ch: string): void {
  if (session === null || metrics === null) return;
  if (session.expectedAt(session.cursor) === "") return;
  session.type(ch);
  // Read the positions back rather than assuming the cursor: by heart, skipped
  // punctuation can put the keystroke further along, and a `ß` typed as `ss`
  // settles nothing on its first `s` and can settle two positions on the next.
  for (const judged of session.judged) metrics.record(judged.index, judged.key, judged.correct);
}

/** One redraw after a burst of input, rather than one per character. */
function afterInput(): void {
  if (session === null) return;
  line.update(session);
  renderMeta();
  renderHint();
  if (session.done) finish();
}

function finish(): void {
  if (session === null || metrics === null || activity === null) return;
  const current = activity;
  const snap = metrics.snapshot();
  finished = snap;

  recordSession(
    {
      at: Date.now(),
      lang,
      kind: current.kind,
      title: activityTitle(),
      chars: session.length,
      ms: snap.ms,
      wpm: snap.wpm,
      accuracy: snap.accuracy,
    },
    metrics.keyCounts(),
  );

  if (current.kind === "text") {
    const next = current.index + 1;
    updateProfile((draft) => {
      // Finishing the last part starts the text over rather than leaving a
      // position that points past the end.
      draft.positions[current.entry.id] = next < current.chunks.length ? next : 0;
    });
  } else if (snap.accuracy >= LESSON_PASS) {
    updateProfile((draft) => {
      if (!draft.lessons.includes(current.lesson.id)) draft.lessons.push(current.lesson.id);
    });
  }

  session = null;
  view = "done";
  render();
}

function continueOn(): void {
  if (activity === null) return;
  if (activity.kind === "text") {
    const next = activity.index + 1;
    if (next >= activity.chunks.length) {
      toLibrary();
      return;
    }
    activity = { ...activity, index: next };
  }
  begin();
}

function toLibrary(): void {
  activity = null;
  session = null;
  metrics = null;
  view = "home";
  render();
}

function focusCapture(): void {
  try {
    ui.capture.focus({ preventScroll: true });
  } catch {
    /* focus is a nicety; never let it break the drill */
  }
  renderHint();
}

// -- Input --------------------------------------------------------------

/**
 * Characters come from the field's value, not from keydown. A dead key on a
 * German layout (´ then e) and an AltGr combination both report as modifier
 * keys in keydown and only become a letter once the field has them.
 */
let composing = false;

function flush(): void {
  const value = ui.capture.value;
  ui.capture.value = "";
  if (value === "" || session === null) return;
  for (const ch of value) typeChar(ch);
  afterInput();
}

// -- Events -------------------------------------------------------------

function wire(): void {
  ui.capture.addEventListener("compositionstart", () => {
    composing = true;
  });
  ui.capture.addEventListener("compositionend", () => {
    composing = false;
    flush();
  });
  ui.capture.addEventListener("input", () => {
    if (!composing) flush();
  });

  ui.capture.addEventListener("keydown", (event) => {
    const caps = event.getModifierState?.("CapsLock") ?? false;
    if (caps !== capsLock) {
      capsLock = caps;
      renderHint();
    }
    if (event.key === "Escape") {
      toLibrary();
      return;
    }
    // A line break is a character here, typed like any other. The field is
    // single-line, so Enter never reaches the input event on its own.
    if (event.key === "Enter") {
      event.preventDefault();
      if (session === null) return;
      typeChar("\n");
      afterInput();
      return;
    }
    // Tab is not a character, so by heart it can ask for the next word without
    // taking a key away from the text. Elsewhere it keeps moving focus.
    if (event.key === "Tab" && activity?.kind === "text" && activity.byHeart) {
      event.preventDefault();
      if (session === null || metrics === null) return;
      metrics.recordHint(session.hint());
      afterInput();
      return;
    }
    if (event.key !== "Backspace") return;
    // An empty field plus Backspace navigates back in some browsers, which
    // would throw the session away.
    event.preventDefault();
    if (session === null) return;
    if (event.ctrlKey || event.altKey) session.backspaceWord();
    else session.backspace();
    metrics?.recordBackspace();
    afterInput();
  });

  ui.capture.addEventListener("blur", () => {
    if (view === "type") renderHint();
  });
  ui.type.addEventListener("pointerdown", () => focusCapture());

  ui.lang.addEventListener("change", () => {
    lang = ui.lang.value === "de" ? "de" : "en";
    settings.setLang(lang);
    // The layout just changed under the text; finishing the old one would file
    // its key counts against the wrong keyboard.
    toLibrary();
  });

  ui.theme.addEventListener("change", () => {
    const theme: Theme = ui.theme.value === "light" ? "light" : "dark";
    settings.setTheme(theme);
    applyTheme(theme);
  });

  ui.statsToggle.addEventListener("change", () => {
    settings.setStats(ui.statsToggle.checked);
    if (view === "type") renderTyping();
  });

  ui.historyLink.addEventListener("click", () => {
    view = "history";
    render();
  });

  ui.back.addEventListener("click", () => toLibrary());
  ui.toLibrary.addEventListener("click", () => toLibrary());
  ui.again.addEventListener("click", () => begin());
  ui.nextChunk.addEventListener("click", () => continueOn());

  ui.importText.addEventListener("click", () => ui.textFile.click());
  ui.textFile.addEventListener("change", () => {
    const file = ui.textFile.files?.[0];
    if (file !== undefined) void addText(file);
    ui.textFile.value = "";
  });

  // Dropping a file anywhere is the shortest path from "I have a text" to
  // typing it.
  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file !== undefined) void addText(file);
  });

  ui.exportButton.addEventListener("click", () => {
    download("typewriter-history.json", exportProfile(), "application/json");
    say("Exported. Keep it somewhere you will find it again.", true);
  });

  ui.importButton.addEventListener("click", () => ui.profileFile.click());
  ui.profileFile.addEventListener("change", () => {
    const file = ui.profileFile.files?.[0];
    ui.profileFile.value = "";
    if (file === undefined) return;
    void file.text().then((raw) => {
      const result = importProfile(raw);
      say(result.message, result.ok);
      if (result.ok) render();
    });
  });
}

async function addText(file: File): Promise<void> {
  if (!/\.txt$/i.test(file.name)) {
    say("Only .txt files.", false);
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    say("That file is too big for browser storage. Put it in texts-local/ instead.", false);
    return;
  }
  const raw = await file.text();
  const id = `imported:${file.name}`;
  const title = extractHeader(clean(raw)).title ?? titleFromPath(file.name);
  updateProfile((draft) => {
    draft.imported = draft.imported.filter((text) => text.id !== id);
    draft.imported.push({ id, title, lang, raw });
  });
  view = "home";
  render();
  say(`Added ${title}.`, true);
}

function say(message: string, ok: boolean): void {
  ui.profileFeedback.textContent = message;
  ui.profileFeedback.className = ok ? "feedback ok" : "feedback bad";
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// -- Boot ---------------------------------------------------------------

function boot(): void {
  initTheme();
  ui.theme.value = settings.theme();
  ui.lang.value = lang;
  ui.statsToggle.checked = settings.stats();
  ui.streamSlot.replaceChildren(strip.element);
  ui.charts.replaceChildren(wpmChart.element, accuracyChart.element);
  wire();
  render();
}

boot();
