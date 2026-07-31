// Per-date archive of the daily-plan word lists, so a parent can look back at
// what was studied on any given day. The live `daily` store key only ever
// holds TODAY (it's overwritten each calendar day); this module snapshots it
// into the `dailylog` key (keyed by date) every time daily state is saved.
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

function renderHtml(log) {
  const dates = Object.keys(log).sort().reverse();
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sections = dates.map(d => {
    const e = log[d];
    const miss = new Set(e.mistakes || []);
    const chips = e.words.map(w => {
      const bad = miss.has(w.word);
      return `<span class="chip${bad ? ' miss' : ''}"><b>${esc(w.word)}</b> ${esc(w.zh)}</span>`;
    }).join('');
    const acc = e.quiz && e.quiz.total ? Math.round(e.quiz.correct / e.quiz.total * 100) + '%' : '—';
    return `<section><h2>${esc(e.date)}</h2>
      <div class="meta">学习 ${e.learnedCount}/${e.total} 词 · 测验正确率 ${acc} · 错题 ${e.mistakes.length} · 离开页面 ${e.leaves} 次 ${e.phase === 'done' ? '· ✓ 已完成' : ''}</div>
      <div class="chips">${chips}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>每日学习单词记录</title>
    <style>
      body{font-family:'Segoe UI',system-ui,sans-serif;background:#f6f3ec;color:#33312c;margin:0;padding:28px;line-height:1.6}
      h1{font-size:1.5rem;margin:0 0 20px}
      section{background:#fff;border:1px solid #e2ddd2;border-radius:12px;padding:16px 18px;margin-bottom:16px;max-width:760px}
      h2{font-size:1.1rem;color:#3d6b96;margin:0 0 4px}
      .meta{font-size:.82rem;color:#7a776e;margin-bottom:12px}
      .chips{display:flex;flex-wrap:wrap;gap:8px}
      .chip{border:1px solid #d9d3c6;border-radius:999px;padding:4px 12px;font-size:.9rem}
      .chip b{font-family:ui-monospace,Consolas,monospace;color:#3d6b96;margin-right:6px}
      .chip.miss{border-color:#c1523f;background:#fbeeeb}
      .empty{color:#7a776e}
    </style></head><body>
    <h1>📖 每日学习单词记录</h1>
    ${sections || '<p class="empty">还没有学习记录。</p>'}
    </body></html>`;
}

function register(app, store) {
  loadWordMap();
  // Backfill today's live session so it's queryable immediately.
  archiveDaily(store, store.getKey('daily'));

  // JSON: all dates (newest first), or one date via ?date=YYYY-MM-DD
  app.get('/api/dailylog', (req, res) => {
    const log = store.getKey('dailylog') || {};
    if (req.query.date) return res.json(log[req.query.date] || null);
    const dates = Object.keys(log).sort().reverse();
    res.json(dates.map(d => log[d]));
  });

  // Human-friendly page for parents to browse.
  app.get('/dailylog', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHtml(store.getKey('dailylog') || {}));
  });
}

module.exports = { register, archiveDaily };
