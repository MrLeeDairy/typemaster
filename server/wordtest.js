// One-off flashcard test page (/wordtest): every word the child has studied,
// ordered easy→hard (by lvl, shuffled within each level), shown English-first.
// The parent/child marks 学会了 / 没学会 per card; each round re-tests only the
// 没学会 words, repeating until none remain. Pure client-side once loaded.
const fs = require('fs');
const path = require('path');

function loadWords() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'words.js'), 'utf8');
  return new Function(src + '; return WORD_LIST;')();
}

function buildDeck(store) {
  const vocab = store.getKey('vocab') || {};
  const map = {};
  loadWords().forEach(w => { map[w.word] = w; });
  const learned = Object.keys(vocab)
    .filter(w => vocab[w] && vocab[w].timesShown > 0)
    .map(w => map[w]).filter(Boolean);
  const byLvl = { 1: [], 2: [], 3: [] };
  learned.forEach(w => byLvl[w.lvl || 3].push({ w: w.word, zh: w.zh, lvl: w.lvl || 3 }));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return [...shuffle(byLvl[1]), ...shuffle(byLvl[2]), ...shuffle(byLvl[3])];
}

function page(deck) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>单词翻卡测试</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#f6f3ec;color:#33312c;
    min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .hud{position:fixed;top:0;left:0;right:0;display:flex;justify-content:center;gap:20px;
    padding:12px;background:rgba(246,243,236,.9);font-size:.85rem;color:#7a776e}
  .hud b{color:#3d6b96}
  .card{background:#fff;border:1px solid #e2ddd2;border-radius:18px;
    width:min(460px,92vw);padding:44px 24px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .lvl{font-size:.75rem;color:#b0a894;letter-spacing:.2em;margin-bottom:14px}
  .word{font-size:clamp(2.2rem,9vw,3.6rem);font-weight:800;
    font-family:ui-monospace,'Cascadia Code',Consolas,monospace;color:#33312c;word-break:break-word}
  .zh{font-size:1.5rem;color:#3d6b96;margin-top:18px;min-height:1.6em}
  .reveal-btn{margin-top:22px;background:#eef2f6;border:1px solid #cfdae6;color:#3d6b96;
    border-radius:999px;padding:10px 24px;font-size:.95rem;cursor:pointer}
  .judge{display:flex;gap:14px;margin-top:26px;width:min(460px,92vw)}
  .judge button{flex:1;border:none;border-radius:14px;padding:18px;font-size:1.1rem;font-weight:700;cursor:pointer}
  .ok{background:#4a8f5c;color:#fff}
  .no{background:#c1523f;color:#fff}
  .done{text-align:center}
  .done h1{font-size:2rem;color:#4a8f5c;margin-bottom:12px}
  .round-toast{font-size:1.05rem;color:#c97b3d;margin:14px 0 0;min-height:1.4em}
  .restart{margin-top:24px;background:none;border:1px solid #cfc8b8;color:#7a776e;
    border-radius:999px;padding:10px 22px;cursor:pointer}
  .hidden{display:none}
</style></head><body>
<div class="hud">
  <span>第 <b id="round">1</b> 轮</span>
  <span>本轮 <b id="prog">0</b> / <b id="total">0</b></span>
  <span>没学会 <b id="pending">0</b></span>
  <span>累计词数 <b id="deck">0</b></span>
</div>

<div id="stage">
  <div class="card">
    <div class="lvl" id="lvl"></div>
    <div class="word" id="word"></div>
    <div class="zh" id="zh"></div>
    <button class="reveal-btn" id="revealBtn" onclick="reveal()">👁 看中文</button>
  </div>
  <div class="round-toast" id="toast"></div>
  <div class="judge">
    <button class="no" onclick="judge(false)">❌ 没学会</button>
    <button class="ok" onclick="judge(true)">✅ 学会了</button>
  </div>
</div>

<div id="doneStage" class="done hidden">
  <h1>🎉 全部学会啦！</h1>
  <p id="doneMsg"></p>
  <button class="restart" onclick="location.reload()">↻ 再测一次</button>
</div>

<script>
const DECK = ${JSON.stringify(deck)};
const LVL = {1:'★☆☆ 简单',2:'★★☆ 中等',3:'★★★ 较难'};
let round = 1, queue = DECK.slice(), idx = 0, notLearned = [];

document.getElementById('deck').textContent = DECK.length;

function render(){
  document.getElementById('round').textContent = round;
  document.getElementById('prog').textContent = idx;
  document.getElementById('total').textContent = queue.length;
  document.getElementById('pending').textContent = notLearned.length;
  if (idx >= queue.length) { endRound(); return; }
  const c = queue[idx];
  document.getElementById('lvl').textContent = LVL[c.lvl] || '';
  document.getElementById('word').textContent = c.w;
  const zh = document.getElementById('zh');
  zh.textContent = c.zh; zh.style.visibility = 'hidden';
  document.getElementById('revealBtn').classList.remove('hidden');
}
function reveal(){
  document.getElementById('zh').style.visibility = 'visible';
  document.getElementById('revealBtn').classList.add('hidden');
}
function judge(learned){
  if (!learned) notLearned.push(queue[idx]);
  idx++;
  render();
}
function endRound(){
  if (notLearned.length === 0){
    document.getElementById('stage').classList.add('hidden');
    const done = document.getElementById('doneStage');
    done.classList.remove('hidden');
    document.getElementById('doneMsg').textContent = '一共测了 ' + DECK.length + ' 个词，用了 ' + round + ' 轮。';
    return;
  }
  round++;
  queue = notLearned;   // already in easy→hard order (filtering preserves it)
  notLearned = [];
  idx = 0;
  const toast = document.getElementById('toast');
  toast.textContent = '进入第 ' + round + ' 轮：还剩 ' + queue.length + ' 个没学会的词';
  setTimeout(() => { toast.textContent = ''; }, 2500);
  render();
}

// keyboard: ← 没学会, → 学会了, 空格 看中文
document.addEventListener('keydown', e => {
  if (document.getElementById('doneStage').classList.contains('hidden') === false) return;
  if (e.key === ' ') { e.preventDefault(); reveal(); }
  else if (e.key === 'ArrowLeft')  judge(false);
  else if (e.key === 'ArrowRight') judge(true);
});

render();
</script>
</body></html>`;
}

function register(app, store) {
  app.get('/wordtest', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(page(buildDeck(store)));
  });
}

module.exports = { register };
