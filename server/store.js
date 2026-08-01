// Tiny local "database" — a single JSON file on disk instead of browser
// localStorage. Kept deliberately simple (no SQLite/native deps) since this
// runs on one family's machine with light write volume; atomic write via
// write-to-temp-then-rename avoids a half-written file if the process dies
// mid-save.
const fs = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Mirrors the four localStorage keys the app used to read/write directly,
// plus newer server-only keys:
//   history   -> typemaster_v1          (typing session history, last 100)
//   mastery   -> typemaster_mastery_v1  (per-word 4-dimension mastery)
//   vocab     -> typemaster_vocab_v1    (flashcard rating / times shown)
//   daily     -> typemaster_daily_v1    (today's daily-plan session state)
//   wrongbook -> (no legacy key)        (cumulative cross-day mistake book)
//   dailylog  -> (no legacy key)        (per-date archive of daily word lists)
//   wordtest  -> (no legacy key)        (flashcard-test progress: streak/graduation)
const DEFAULTS = {
  history: [],
  mastery: {},
  vocab: {},
  daily: null,
  wrongbook: {},
  dailylog: {},
  wordtest: {}
};

const ALLOWED_KEYS = Object.keys(DEFAULTS);

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf8');
  }
}

function readAll() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeAll(data) {
  ensureDataFile();
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function getKey(key) {
  return readAll()[key];
}

function setKey(key, value) {
  const all = readAll();
  all[key] = value;
  writeAll(all);
}

module.exports = { ALLOWED_KEYS, getKey, setKey, readAll };
