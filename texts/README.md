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

The seed texts here were typed from memory, not copied from a verified edition,
so treat them as placeholders: a wrong word is a wrong word you will practise a
hundred times. Replace them with files from Project Gutenberg, Wikisource or the
Deutsches Textarchiv, which is the workflow this folder exists for anyway.

Everything else goes in `texts-local/`, which is gitignored and never leaves
your machine, or through the app's own import button, which keeps the text in
your browser only.
