# Type2Memory

A local typing-practice and English vocabulary app, built for a 14-year-old to
practice keyboard typing, spelling, listening, and word meaning — all sharing
one word library.

Runs entirely on your own machine: a small Node/Express server serves the
frontend and persists progress to a JSON file on disk. No account, no cloud,
no external services.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (comes with `npm`)

## Running it

```bash
npm install
npm start
```

Then open **http://localhost:3210** in Chrome.

The port can be changed with an environment variable if 3210 is already in use:

```bash
PORT=4000 npm start
```

## What's inside

- **打字练习 (Typing practice)** — word / sentence / fill-in-blank / listening
  modes, a virtual keyboard overlay, key-error heatmap, and a match-game
  review of missed words after each session.
- **背单词 (Vocabulary)** — flashcards with example sentences (English +
  word-by-word Chinese breakdown + full translation + audio), a free-practice
  quiz, and a **guided daily learning plan**:
  - 60-minute session clock that only counts while the tab is active and
    you've interacted recently (pauses automatically otherwise, and can be
    paused/resumed manually).
  - 15 new words a day, drawn from a difficulty ladder (easy → medium → hard)
    so a session never mixes trivial words with advanced ones — the next
    difficulty level only unlocks once ~90% of the current one has been
    introduced.
  - Each new word: read the card → recall its spelling from the Chinese
    meaning alone (no peeking) → record yourself saying it and compare
    against the built-in pronunciation → a quick meaning check → then the
    example sentence plays as a reward. Capped at 3 minutes per word so one
    hard word doesn't eat the whole session; a skip button avoids getting
    stuck.
  - Remaining time is spent on a quiz cycling spelling (typed, not
    multiple-choice), pronunciation repeat-after, and meaning checks —
    weighted toward today's words but still reviewing recently-learned ones.
    Get something wrong three times in a row and it switches to writing the
    word out five times before moving on.
  - Every quiz mistake is logged and shown on the daily results screen (and
    from the vocab home screen any time that day) so a parent can review
    what tripped the child up.
- **3000-word milestone** — the library includes the official Oxford 3000
  word list (~2861 words) alongside a hand-curated set, tagged by difficulty
  and tracked toward a 3000-word goal.

## Project structure

```
index.html        Frontend — the entire UI and app logic in one file
assets/words.js    Word library ({ word, zh, pos, lvl } per entry)
words.md           Hand-curated word source list (import target for words.js)
server/
  server.js        Express app: serves the frontend, exposes the data API
  store.js          JSON-file "database" (data/store.json), atomic writes
data/
  store.json        Created automatically on first run — not committed
```

## Data & persistence

Progress used to live in the browser's `localStorage`; it's now served by
the backend and stored in `data/store.json` (created automatically the first
time you run the server). This means:

- Progress survives clearing browser data, and can be backed up by copying
  that one file.
- If the server isn't running, the app still works for that session (typing,
  quizzes, etc. all function), it just won't remember anything once the page
  is closed.

`data/store.json` is not committed to this repository (see `.gitignore`) —
it's personal practice data, not project source.

## Study mode (focus lockdown)

The app is fully local, so it works with the internet cut off. To stop a
child from looking up answers mid-quiz:

- **`tools/study-mode-setpass.bat`** — one-time setup: set the management
  password (changing it later requires the current password). Stored as a
  salted hash in `%ProgramData%\Type2Memory`, outside the repo.
- **`tools/study-mode-on.bat`** — no password needed; anyone can lock.
  Adds Windows Firewall rules blocking every installed browser's internet
  access (localhost is unaffected), makes sure the server is running, and
  opens the app fullscreen in Chrome kiosk mode.
- **`tools/study-mode-off.bat`** — asks for the management password, then
  removes the rules and restores normal browsing.

The app also detects tab/window switches during an active quiz question:
the question is immediately scored wrong (looking up the answer is
pointless), the word is queued for the round review, and the number of
leaves is shown on the daily results screen for the parent.

Note: the password gates the easy path (the off script). A child whose
Windows account has administrator rights could still remove the firewall
rules manually via Windows Defender Firewall settings — making their
account a standard user is the only hard guarantee.

## Adding new words

Edit `words.md` and ask for a re-import — new words get deduplicated
against what's already in `assets/words.js` automatically. Every entry needs
a `lvl` (1 = easy, 2 = medium, 3 = hard) so the daily plan's difficulty
ladder can place it correctly.
