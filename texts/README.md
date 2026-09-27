# Practice texts

Drop a `.txt` file in `en/` or `de/` and it appears in the app. The folder is
what sets the language; there is no list to update and no build step to run.

- While `npm run dev` is running, saving a file here is enough -- the page
  reloads and the text is in the picker.
- Pushing to `main` publishes it: the build bakes every file in this folder into
  the site.

The first line may be `# Some Title`, which names the text and is not typed.
Otherwise the filename is used, so `die-verwandlung.txt` reads as
"Die Verwandlung".

The line under it may be `Source: https://...`, the edition the text was taken
from. It is not typed either; the library shows it as a "source" link. **Every
poem needs one** -- a test fails without it -- because a copy that gets a
comma or a line ending wrong has changed the poem. Link the exact version, e.g.
a Wikisource permanent link (`...&oldid=...`):

```
# Der Zauberlehrling
Source: https://de.wikisource.org/w/index.php?title=Der_Zauberlehrling_(1827)&oldid=3467076

Hat der alte Hexenmeister
Sich doch einmal wegbegeben!
```

A poem is typed in one piece, line by line: the current line is marked, with
the lines before it above and the lines after it below. The blank line between
stanzas is typed as a second Enter. Prose is split into parts at its
paragraphs.

Save as **UTF-8**. Notepad can still write UTF-16, which arrives as unreadable
characters; the app flags such a file rather than offering it.

## What belongs here

**This folder is published.** Committing a copyrighted book puts a copy of it on
the public web under your name, which is not something a typing tutor needs to
do. Keep this folder to:

- public-domain sources (Project Gutenberg, Wikisource, Deutsches Textarchiv),
- your own writing,
- anything else you hold the rights to.

## Check the text before you trust it

This folder holds only texts the owner asked for. Never type one in from
memory: a wrong word is a wrong word you will practise a hundred times.
Download it from Project Gutenberg, Wikisource or the Deutsches Textarchiv,
strip only the markup, and keep the edition's spelling, punctuation and line
breaks exactly.
`der-zauberlehrling.txt` is the 1827 text from Wikisource, which transcribes and
proofreads it against page scans.

Everything else goes in `texts-local/`, which is gitignored and never leaves
your machine, or through the app's own import button, which keeps the text in
your browser only.
