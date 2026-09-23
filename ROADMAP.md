# Roadmap

## Done

The typing line, the text library, the ladder and the statistics all shipped.
See `CLAUDE.md` for how they fit together, and treat these as settled decisions:

- **A mistake reddens everything after it** and the part cannot finish until it
  is deleted. No skipping, no auto-correct, no highlight-only mode.
- **Backspace is unlimited.** It runs back through correct text to the start;
  nothing is locked in once typed.
- **Accuracy judges the first attempt at each position.** Fixing a mistake is
  the right thing to do and does not erase it.
- **The folder is the language.** `texts/de/...` is German, and that is the only
  metadata a text has.
- **No on-screen keyboard.** The minimalism is the aesthetic, not an omission.
- **No accounts.** A static site already gives every visitor a private history;
  the JSON export covers the rest. See `CLAUDE.md`.

## Possible next

Nothing here is agreed -- ask before building any of it.

- Drills generated from your own weak keys. The per-key tally is already shaped
  for it; it needs a generator and a place to launch it from.
- A words-per-minute target or a daily streak, if that turns out to be
  motivating rather than stressful.
- Respecting line breaks for poetry and code, where the paragraph-flattening
  that prose needs is wrong.
- More languages. `layouts.ts` and the ladder are the only places that know
  about a keyboard, so a third is data plus a rung list.
- Local profiles: a name on the device so a shared computer keeps two histories.
  No passwords, no server.

## Non-goals

Accounts, server-side sync, and a leaderboard. Comparison is the opposite of
what this app is for, and storing other people's practice history would turn a
static page into a service with duties attached. The storage seam allows sync
later; nothing should be added to serve it today.

Sound, mobile support, and an on-screen keyboard.
