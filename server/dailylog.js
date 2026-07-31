// Per-date archive of the daily-plan word lists, so a parent can look back at
// what was studied. The live `daily` store key only ever holds TODAY (it's
// overwritten each calendar day); this module snapshots it into the `dailylog`
// key (keyed by date) every time daily state is saved.
//
// Presentation has two parts:
//   - "今天之前": one cumulative list of everything practiced before today.
//     The exact per-day new-15 wasn't archived before this log existed, so we
//     don't fabricate a per-day split — we just show the deduped set.
//   - Today onward: one accurate card per day (the day's real 15 words),
//     growing as more days are recorded.
const fs = require('fs');
const path = require('path');

// Load word -> Chinese map from the frontend word library so the archive can
// show meanings, not just bare English. Read once at startup.
let WORD_MAP = {};
function loadWordMap() {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'words.js'), 'utf8');
    const list = new Function(src + '; return WORD_LIST;')();
    const map = {};
    list.forEach(w => { map[w.word] = w.zh; });
    WORD_MAP = map;
  } catch (e) {
    console.warn('dailylog: could not load word library for meanings', e.message);
  }
}

// Snapshot a daily-state object into the dated archive.
function archiveDaily(store, daily) {
  if (!daily || !daily.date || !Array.isArray(daily.wordList)) return;
  const log = store.getKey('dailylog') || {};
  log[daily.date] = {
    date: daily.date,
    words: daily.wordList.map(w => ({ word: w, zh: WORD_MAP[w] || '' })),
    learnedCount: Math.min(daily.wordIdx || 0, daily.wordList.length),
    total: daily.wordList.length,
    phase: daily.phase || 'learn',
    quiz: daily.quiz ? { correct: daily.quiz.correct || 0, total: daily.quiz.total || 0 } : null,
    mistakes: (daily.mistakes || []).map(m => m.word),
    leaves: daily.leaves || 0,
    updatedAt: Date.now()
  };
  store.setKey('dailylog', log);
}

function dateStr(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayStr() { return dateStr(Date.now()); }

// Everything practiced BEFORE today, consolidated (deduped) from vocab. Each
// word carries the last date it was practiced.
function historicalWords(store) {
  const today = todayStr();
  const vocab = store.getKey('vocab') || {};
  const out = [];
  for (const [w, rec] of Object.entries(vocab)) {
    if (!rec || !rec.lastReviewed) continue;
    if (dateStr(rec.lastReviewed) >= today) continue; // today onward shown per-day
    out.push({ word: w, zh: WORD_MAP[w] || '', date: dateStr(rec.lastReviewed) });
  }
  out.sort((a, b) => a.word.localeCompare(b.word));
  return out;
}

// Accurate per-day archive for today and any later days, newest first.
function accurateDays(store) {
  const today = todayStr();
  const log = store.getKey('dailylog') || {};
  return Object.keys(log).filter(d => d >= today).sort().reverse().map(d => log[d]);
}

function renderHtml(store) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const hist = historicalWords(store);
  const days = accurateDays(store);

  const daySections = days.map(e => {
    const miss = new Set(e.mistakes || []);
    const chips = e.words.map(w =>
      `<span class="chip${miss.has(w.word) ? ' miss' : ''}"><b>${esc(w.word)}</b> ${esc(w.zh)}</span>`).join('');
    const acc = e.quiz && e.quiz.total ? Math.round(e.quiz.correct / e.quiz.total * 100) + '%' : '—';
    const meta = `学习 ${e.learnedCount}/${e.total} 词 · 测验正确率 ${acc} · 错题 ${(e.mistakes || []).length} · 离开页面 ${e.leaves || 0} 次 ${e.phase === 'done' ? '· ✓ 已完成' : ''}`;
    return `<section><h2>${esc(e.date)}${e.date === todayStr() ? ' · 今天' : ''}</h2>
      <div class="meta">${meta}</div>
      <div class="chips">${chips}</div></section>`;
  }).join('');

  const histChips = hist.map(w =>
    `<span class="chip"><b>${esc(w.word)}</b> ${esc(w.zh)}</span>`).join('');
  const histSection = `<section class="hist"><h2>今天之前 · 累计学过 ${hist.length} 词</h2>
    <div class="meta">启用精确记录之前的历史，按最近练习日期汇总，不再拆分到每一天</div>
    <div class="chips">${histChips || '<span class="empty">暂无</span>'}</div></section>`;

  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>每日学习单词记录</title>
    <style>
      body{font-family:'Segoe UI',system-ui,sans-serif;background:#f6f3ec;color:#33312c;margin:0;padding:28px;line-height:1.6}
      h1{font-size:1.5rem;margin:0 0 6px}
      .intro{font-size:.85rem;color:#7a776e;margin:0 0 20px;max-width:760px}
      section{background:#fff;border:1px solid #e2ddd2;border-radius:12px;padding:16px 18px;margin-bottom:16px;max-width:760px}
      section.hist{background:#faf8f3;border-style:dashed}
      h2{font-size:1.1rem;color:#3d6b96;margin:0 0 4px}
      .meta{font-size:.82rem;color:#7a776e;margin-bottom:12px}
      .chips{display:flex;flex-wrap:wrap;gap:8px}
      .chip{border:1px solid #d9d3c6;border-radius:999px;padding:4px 12px;font-size:.9rem}
      .chip b{font-family:ui-monospace,Consolas,monospace;color:#3d6b96;margin-right:6px}
      .chip.miss{border-color:#c1523f;background:#fbeeeb}
      .empty{color:#7a776e}
    </style></head><body>
    <h1>📖 每日学习单词记录</h1>
    <p class="intro">「今天之前」是一张累计表；从今天起，每天新学的 15 个词各自成表，学到哪天就显示到哪天。</p>
    ${daySections}
    ${histSection}
    </body></html>`;
}

function register(app, store) {
  loadWordMap();
  // Backfill today's live session so it's queryable immediately.
  archiveDaily(store, store.getKey('daily'));

  // JSON: { before: [...cumulative], days: [...per-day today onward] };
  // or a single archived day via ?date=YYYY-MM-DD
  app.get('/api/dailylog', (req, res) => {
    if (req.query.date) {
      const log = store.getKey('dailylog') || {};
      return res.json(log[req.query.date] || null);
    }
    res.json({ before: historicalWords(store), days: accurateDays(store) });
  });

  // Human-friendly page for parents to browse.
  app.get('/dailylog', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHtml(store));
  });
}

module.exports = { register, archiveDaily };
