# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev                           # Vite dev server on :5173
npm test                              # vitest, single run
npm run test:watch                    # vitest in watch mode
npx vitest run src/typing.test.ts     # one test file
npx vitest run -t "clears the error"  # one test by name
npm run typecheck                     # tsc --noEmit
npm run build                         # typecheck, then static build into dist/
```

`start.cmd` is the double-click entry point: it installs if needed, then runs
`npm run dev`, which opens a browser by itself via `server.open` in
`vite.config.ts`. Batch files are pinned to CRLF in `.gitattributes` -- cmd.exe
can mis-parse labels in LF-only files, so do not "normalise" them.

The first jsdom run on Windows can take most of a minute to start its
environment and trip the 60s timeout; the second run is warm. Re-run before
concluding anything is broken.

## Architecture

A typing tutor: vanilla TypeScript on Vite, no UI framework, no router, no
backend, no runtime dependencies. Every screen is a `<section>` in
`index.html`; one `render()` in `src/main.ts` redraws from state on every event.

**The typing engine (`src/typing.ts`)** -- state is only the target string and
`pressed`, what was actually typed. `cursor`, `firstError`, `isError` and `done`
are all derived, which is why backspace can run anywhere without a second code
path. `firstError` is a field rather than a rescan because it is read on every
keystroke.

One wrong character reddens **everything after it**, so the only way forward is
to delete back to it. There is intentionally no auto-advance, no skip, no
highlight-only mode, and backspace is deliberately unlimited -- it may run
through correct text to the start. Do not soften any of that without being asked
to.

**Statistics (`src/metrics.ts`)** -- separate from the session because the
session is what is on screen now and the tally is how it got there. A position
is judged by its **first attempt only**: backspacing over a mistake and retyping
it correctly still counts as the miss it was, or accuracy would be worthless.
The clock advances by the gap between keystrokes, capped at 3s, so an idle pause
and a switched tab are the same thing and neither needs an event handler.

**Texts (`src/text.ts`, `src/library.ts`)** -- `import.meta.glob` over
`texts/**/*.txt` and `texts-local/**/*.txt` is the one deliberate departure from
StateLearner's static-imports rule, and it is the whole feature: a file dropped
in the folder appears with no registry to edit. Vite resolves it at build time,
so the published site is still a plain static bundle.

The folder sets the language (`texts/de/...` is German); a leading `# Title`
line names the text, otherwise the filename does. An optional `Source: <url>`
line under it links the edition, shown as "source" in the library; a test
fails if a published poem lacks one. `texts-local/` is gitignored, so those
texts work locally and are never published.

**Never write a text from memory.** Download it (Wikisource, Projekt Gutenberg,
Deutsches Textarchiv), strip only the markup, and keep the edition's spelling,
punctuation and line breaks exactly -- those are the poem. Link the exact
revision.

**The text is never rewritten.** An earlier version replaced curly quotes,
dashes and ellipses with ASCII lookalikes so every character was reachable.
That is the wrong trade -- punctuation is part of the writing and in verse part
of the art -- so the tolerance lives on the *input* side instead: `STAND_INS` in
`typing.ts` accepts `"` for `„` and `-` for `—`, one keystroke per
position, while the line still shows what the author wrote. Do not reintroduce
normalisation of the text itself.

`prepare()` only settles the encoding (BOM, NFC, CRLF) and removes genuinely
invisible characters -- a zero-width space or soft hyphen is a cell with no
glyph and no key, which reads as the line refusing your keystroke.

**Line breaks are kept**, because a poem's lineation is the poem. A newline is
an ordinary position, typed with Enter and drawn as a dim `\u21b5`; it must
never reach the DOM as a real newline, which `white-space: pre` would act on.
In prose, blank lines separate chunks, so a paragraph is one part. **A poem is
never split** (`looksLikeVerse()`: most blocks several lines long, not
wrapped): it is one chunk, and the blank line between stanzas stays in it as a
second Enter. Do not cut poems at stanzas again -- the user asked for this.

Hard-wrapped prose (Project Gutenberg wraps at ~70 characters) would otherwise
put an Enter mid-sentence that the author never wrote. `looksWrapped()` spots it
and the library offers a per-text "lines joined" switch -- **the guess is never
applied on its own**, because silently joining a poem would destroy it.

**Lessons (`src/lessons.ts`, `src/layouts.ts`)** -- rungs are `[name, new keys]`
and inherit everything above them; never restate a full key set, or the two
ladders drift apart. German is its own ladder, not English plus umlauts: y and z
trade places, the umlauts take the keys `;'[` hold on a US board, and `ß` gets
its own rung. Drill text is generated from a seeded injectable rng so tests are
deterministic and no lesson becomes an order you memorise. Lessons are never
locked -- clearing one at 97% marks it, and that is all.

`layouts.ts` is read twice: by the ladder and by the per-finger statistics. The
browser cannot detect a physical layout, so the language switch is the user
telling us, and changing it returns to the library rather than finishing a text
against the wrong keyboard.

**The line (`src/stream.ts`)** -- spans in an `overflow: hidden` window, moved
by `translateX(-cursor ch)` with the caret pinned at 38%. The font is monospace
**for this one element**, which is what makes `ch` exact and means nothing has to
be measured. The whole chunk is in the DOM: a window that slid with the caret
would drop cells off the front and move the line with no transition to carry it,
and `text.ts` caps a chunk at a few hundred characters anyway. A wrong cell shows
**what was typed**, not what was expected, because that is what tells you which
letter to delete.

**Verse (`src/verse.ts`)** -- a part containing `\n` is typed as rows instead:
one row per line, the current one marked and held fourth of seven, earlier
lines above, later ones below, and the neighbouring parts dimmed as context.
The type shrinks via `--cols` and container units until the longest line fits,
so a verse line is never cut or scrolled sideways -- still nothing measured.
`paintCell()` in `stream.ts` draws a cell for both views; `main.ts` picks the
view per part in `begin()`.

**Input (`src/main.ts`)** -- characters come from the capture field's value, not
from `keydown`. A dead key (`´` then `e`) and an AltGr combination both report as
modifier keys in `keydown` and only become a letter once the field has them;
`compositionend` covers the composing case. `keydown` handles only Backspace
(preventDefault, or an empty field navigates back), Escape and Caps Lock
detection. This is the single most likely place a German keyboard breaks, so
test umlauts and `ß` on real hardware, not only in jsdom.

There is no letter-key shortcut for hiding the statistics. In an app where every
letter is input, a letter cannot also be a command -- the header toggle is it.

**Persistence (`src/storage.ts`)** -- `localStorage` only, every access
try/catch'd. One `typewriter:profile` blob holds sessions, key counts, cleared
lessons, saved positions, the per-text line choice and browser-imported texts;
settings are separate flat keys. `parseProfile()` validates every row because the same function reads a
**file the user picked off their disk**, so that validation is load-bearing.

**No accounts, by decision.** A static bundle already gives every visitor their
own private storage; accounts would add a backend, auth, and GDPR duties over
other people's data. The JSON export is the only backup that exists, which is
why the history screen says so out loud. Keep new storage behind
`profile()`/`updateProfile()` so sync stays one module away.

**Charts (`src/chart.ts`)** -- speed and accuracy get a chart each. Never put
them on one plot with two y-scales: a dual axis lets the lines be placed
wherever flatters, which is the wrong property for a number you are being honest
with yourself about.

**Theme** -- dark is the default and there is no "follow the OS" option. Tokens
are declared twice in `style.css`: bare `:root` carries the dark palette so the
first paint is dark with no flash, and `:root[data-theme="light"]` overrides it.
Both blocks must define the same token set; adding a colour to only one is the
usual bug. `prefers-color-scheme` is deliberately not consulted.

## Tests

`src/app.test.ts` boots the real `index.html` under jsdom and drives a text end
to end through the real input path (the field's value, not synthetic keys). It
is what catches a renamed id or a screen that never unhides. It needs
`vi.resetModules()` before re-importing `main.ts`, and must read `index.html`
via `process.cwd()` -- under jsdom `import.meta.url` is an http URL, not a file
one. The forks pool times out starting a jsdom worker on Windows, so
`vitest.config.ts` pins `pool: "threads"`.

## Conventions

- `tsconfig.json` is strict plus `noUncheckedIndexedAccess`, so indexing an array
  yields `T | undefined` -- handle it rather than widening the config.
- `verbatimModuleSyntax` is on: import types with `import type`.
- `vite.config.ts` sets `base: "./"` so `dist/` works from any subpath.
- UI text is English, always, including when the request was written in German.
  The language switch changes the content and the layout, never the interface.
- Texts in `texts/` are published. Public-domain or your own only; everything
  else belongs in `texts-local/` or in browser import. **Only texts the user
  names go in** -- never add one on your own initiative, not even as a sample.
  Tests must not depend on what is in `texts/` beyond that; `app.test.ts`
  brings its own prose through the import path.
- Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
  `base: "./"` is what makes the build work from the Pages subpath; leave it.
