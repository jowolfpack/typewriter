# Typewriter

A calm typing tutor. One line of text, grey ahead of you and plain behind,
scrolling past a caret that never moves. Your own `.txt` files are the practice
material; there is a beginner's ten-finger ladder for anyone who needs one.

No keyboard diagram, no confetti, no sound. English and German, with the
layout difference taken seriously.

## Running it

Double-click `start.cmd`, or:

```sh
npm install
npm run dev
```

## How it works

Pick a text and type it. Your typing appears in place of the grey.

Get a letter wrong and **everything from the mistake onward turns red**. Typing
carries on in red, but the part cannot finish until the red is gone -- you
delete back to the mistake and type it properly. Backspace is unlimited; it will
run back through correct text as far as you like.

Long texts are split into parts of a few hundred characters, and your position
is remembered, so a chapter can be picked up days later.

Statistics sit under the line and switch off from the header. Words per minute
counts correct characters divided by five; the clock stops after three seconds
of not typing, so a pause is not punished. Accuracy judges each position by your
**first** attempt at it -- fixing a mistake is right, but it does not erase it.

`Esc` returns to the library.

## Adding your own texts

Put a `.txt` file in `texts/en/` or `texts/de/` -- the folder sets the language.
While the dev server is running it appears immediately. That is the whole
mechanism: no list to update, no build step to run.

The first line may be `# Some Title`, which names it and is not typed.
Otherwise the filename is used. Save as UTF-8; a file that arrives as UTF-16 is
flagged rather than offered as gibberish.

Curly quotes, en dashes, ellipses and non-breaking spaces are rewritten into
characters your keyboard can actually produce. Without that you would reach a
character you cannot type and simply be stuck.

### Three places a text can live

| Where | Who sees it | How it gets there |
| --- | --- | --- |
| `texts/` | everyone, once pushed | commit it |
| `texts-local/` | only this checkout | gitignored; never published |
| Browser import | only this browser | drag a `.txt` onto the page |

**`texts/` is published to the web.** Keep it to public-domain sources or your
own writing -- committing a copyrighted book puts a copy of it online under your
name. Everything else belongs in `texts-local/` or in browser import.

## Publishing, and how the texts get there

Pushing to `main` is the sync. GitHub Actions runs the tests, builds the site,
and deploys it to GitHub Pages; the build bakes every file in `texts/` into the
bundle, so a text you committed is live a minute later. There is no server and
nothing to upload.

One manual step on a fresh repository: **Settings -> Pages -> Source -> GitHub
Actions**. Without it the first deploy fails.

## Your history

Everything is kept in your browser's local storage and nothing is sent anywhere.
There are no accounts, and none are needed -- the site is static, so every
visitor already has their own private history that nobody else can see.

The flip side is that clearing site data erases it and no one can recover it for
you. The **Export** button on the history screen writes a JSON file; **Import**
reads it back, which is also how you move your history to another machine.

## Languages

The switch in the header changes the text language *and* the keyboard layout the
app assumes -- a browser cannot detect your physical keyboard, so you have to
tell it. German gets QWERTZ, which is not QWERTY with two extra letters: `y` and
`z` trade places, the umlauts sit where `;'[` are on a US board, and `ß` has its
own key. The finger statistics and the lesson ladder both follow.

The interface itself stays in English.

## Basic training

Around twenty rungs per language, from the home keys outward to punctuation and
numbers. Drill text is generated fresh each time, so no lesson turns into a
sequence you have memorised. Nothing is locked -- every rung is open from the
start, and clearing one at 97% accuracy simply marks it.

## What it will not do

No on-screen keyboard: looking at your hands is the habit this is meant to
break. No sound, no accounts, no leaderboard, and no mobile support -- without a
physical keyboard there is nothing here to use.
