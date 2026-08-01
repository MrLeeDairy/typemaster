// Smart flashcard test page (/wordtest).
//
// Flow: the parent types how many words to test; that many are drawn from the
// studied words (weighted toward the weakest, mixing difficulty, shuffled).
// A complete test is up to 3 passes: the first pass over all N, then a re-test
// of whatever was 没学会, then one more re-test of what's still 没学会 — then done.
//
// Progress persists in the `wordtest` store key. A word graduates (stops being
// offered in future tests) after 3 CONSECUTIVE 学会了; a 没学会 resets the streak.
// Every card is saved the instant it's judged, so stopping early keeps marks.
const fs = require('fs');
const path = require('path');

const GRADUATE_STREAK = 3;
const MAX_PASSES = 3;

function loadWords() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'words.js'), 'utf8');
  return new Function(src + '; return WORD_LIST;')();
}

function eligiblePool(store) {
  const vocab = store.getKey('vocab') || {};
  const prog  = store.getKey('wordtest') || {};
  const map = {};
  loadWords().forEach(w => { map[w.word] = w; });
  return Object.keys(vocab)
    .filter(w => vocab[w] && vocab[w].timesShown > 0)
    .map(w => map[w]).filter(Boolean)
    .map(w => {
      const p = prog[w.word] || { streak: 0, learned: 0, wrong: 0 };
      return { w: w.word, zh: w.zh, lvl: w.lvl || 3, streak: p.streak || 0, wrong: p.wrong || 0 };
    })
    .filter(x => x.streak < GRADUATE_STREAK);
}

function stats(store) {
  const vocab = store.getKey('vocab') || {};
  const prog  = store.getKey('wordtest') || {};
  const studied = Object.keys(vocab).filter(w => vocab[w] && vocab[w].timesShown > 0);
  const graduated = studied.filter(w => prog[w] && prog[w].streak >= GRADUATE_STREAK).length;
  return { studied: studied.length, graduated, remaining: studied.length - graduated };
}

// Weighted-shuffle the whole eligible pool (weak & far-from-graduating first-ish),
// so the client can just take the first N the parent asks for.
function weightedOrder(pool) {
  const items = pool.map(p => ({ p, weight: 1 + p.wrong * 2 + (GRADUATE_STREAK - p.streak) }));
  const out = [];
  while (items.length) {
    const total = items.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total, i = 0;
    for (; i < items.length; i++) { r -= items[i].weight; if (r <= 0) break; }
    if (i >= items.length) i = items.length - 1;
    out.push(items[i].p);
    items.splice(i, 1);
  }
  return out;
}

function page(pool, st) {
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>单词翻卡测试</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#f6f3ec;color:#33312c;
    min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
  .hud{position:fixed;top:0;left:0;right:0;display:flex;flex-wrap:wrap;justify-content:center;gap:16px;
    padding:12px;background:rgba(246,243,236,.92);font-size:.82rem;color:#7a776e}
  .hud b{color:#3d6b96}
  .card{background:#fff;border:1px solid #e2ddd2;border-radius:18px;
    width:min(460px,92vw);padding:40px 24px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .lvl{font-size:.75rem;color:#b0a894;letter-spacing:.2em;margin-bottom:14px}
  .word-row{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
  .word{font-size:clamp(2.1rem,8.5vw,3.4rem);font-weight:800;
    font-family:ui-monospace,'Cascadia Code',Consolas,monospace;color:#33312c;word-break:break-word}
  .spk{flex-shrink:0;width:48px;height:48px;border-radius:50%;border:1px solid #cfdae6;background:#eef2f6;
    font-size:1.4rem;cursor:pointer;color:#3d6b96}
  .zh{font-size:1.5rem;color:#3d6b96;margin-top:18px;min-height:1.6em}
  .reveal-btn{margin-top:22px;background:#eef2f6;border:1px solid #cfdae6;color:#3d6b96;
    border-radius:999px;padding:10px 24px;font-size:.95rem;cursor:pointer}
  .judge{display:flex;gap:14px;margin-top:22px;width:min(460px,92vw)}
  .judge button{flex:1;border:none;border-radius:14px;padding:18px;font-size:1.1rem;font-weight:700;cursor:pointer}
  .ok{background:#4a8f5c;color:#fff}
  .no{background:#c1523f;color:#fff}
  .stop{margin-top:14px;background:none;border:1px solid #cfc8b8;color:#7a776e;border-radius:999px;padding:8px 20px;cursor:pointer;font-size:.85rem}
  .toast{font-size:1.02rem;color:#c97b3d;margin-top:14px;min-height:1.4em;text-align:center}
  .start{background:#fff;border:1px solid #e2ddd2;border-radius:18px;width:min(440px,92vw);padding:32px 26px;text-align:center}
  .start h1{font-size:1.4rem;margin-bottom:6px}
  .start p{color:#7a776e;font-size:.88rem;margin-bottom:18px}
  .start input{font-size:1.6rem;width:130px;text-align:center;padding:8px;border:1px solid #cfdae6;border-radius:10px}
  .start .go{display:block;width:100%;margin-top:18px;background:#3d6b96;color:#fff;border:none;border-radius:14px;padding:15px;font-size:1.05rem;font-weight:700;cursor:pointer}
  .done{text-align:center}
  .done h1{font-size:1.7rem;color:#4a8f5c;margin-bottom:10px}
  .done .grad{color:#c97b3d;margin:10px 0}
  .btnbar{display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap}
  .btnbar a,.btnbar button{text-decoration:none;border-radius:999px;padding:11px 22px;font-size:.95rem;font-weight:700;cursor:pointer;border:none}
  .primary{background:#3d6b96;color:#fff}
  .ghost{border:1px solid #cfc8b8;color:#7a776e;background:none}
  .hidden{display:none}
</style></head><body>
<div class="hud">
  <span>已毕业 <b>${st.graduated}</b> / ${st.studied}</span>
  <span>待掌握 <b>${st.remaining}</b></span>
  <span id="hudRound"></span>
</div>

<!-- Start: choose how many words -->
<div id="startStage" class="start">
  <h1>单词翻卡测试</h1>
  <p>可测的单词共 <b>${st.remaining}</b> 个（连续答对 3 次的词已毕业，不再出现）。<br>想测多少个？</p>
  <input id="numInput" type="number" min="1" max="${st.remaining}" value="${Math.min(20, st.remaining) || 1}">
  <button class="go" onclick="startTest()">开始测试 ▶</button>
</div>

<!-- Card -->
<div id="stage" class="hidden">
  <div class="card">
    <div class="lvl" id="lvl"></div>
    <div class="word-row">
      <div class="word" id="word"></div>
      <button class="spk" onclick="speak()" title="发音提示">🔊</button>
    </div>
    <div class="zh" id="zh"></div>
    <button class="reveal-btn" id="revealBtn" onclick="reveal()">👁 看中文</button>
  </div>
  <div class="judge">
    <button class="no" onclick="judge(false)">❌ 没学会</button>
    <button class="ok" onclick="judge(true)">✅ 学会了</button>
  </div>
  <div class="toast" id="toast"></div>
  <button class="stop" onclick="finish(true)">提前结束</button>
</div>

<div id="doneStage" class="done hidden">
  <h1 id="doneTitle">测试完成！</h1>
  <p id="doneMsg"></p>
  <p class="grad" id="gradMsg"></p>
  <div class="btnbar">
    <button class="primary" onclick="location.reload()">再测一次 ↻</button>
    <a class="ghost" href="/">返回主页</a>
  </div>
</div>

<script>
const POOL = ${JSON.stringify(pool)};       // eligible words, weighted-shuffled
const LVL = {1:'★☆☆ 简单',2:'★★☆ 中等',3:'★★★ 较难'};
const MAX_PASSES = ${MAX_PASSES};
let deck = [], pass = 0, idx = 0, notLearned = [], startN = 0, graduatedNow = [];

let voice = null;
function pickVoice(){ const vs = speechSynthesis.getVoices();
  voice = vs.find(v=>v.lang.startsWith('en')&&v.localService) || vs.find(v=>v.lang.startsWith('en')) || null; }
if ('speechSynthesis' in window){ pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(){ if(!('speechSynthesis'in window)||idx>=deck.length)return;
  speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(deck[idx].w);
  u.lang='en-US'; u.rate=.7; if(voice)u.voice=voice; speechSynthesis.speak(u); }

function startTest(){
  let n = parseInt(document.getElementById('numInput').value, 10) || 0;
  n = Math.max(1, Math.min(n, POOL.length));
  deck = POOL.slice(0, n);
  startN = n; pass = 1; idx = 0; notLearned = []; graduatedNow = [];
  document.getElementById('startStage').classList.add('hidden');
  document.getElementById('stage').classList.remove('hidden');
  render();
}
function render(){
  if (idx >= deck.length){ endPass(); return; }
  document.getElementById('hudRound').innerHTML = '第 <b>'+pass+'</b> 轮 · <b>'+idx+'</b>/'+deck.length;
  const c = deck[idx];
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
  if (idx >= deck.length) return;
  const c = deck[idx];
  if (!learned) notLearned.push(c);
  fetch('/api/wordtest/mark', {method:'POST',headers:{'Content-Type':'application/json'},
    body: JSON.stringify({word:c.w, learned})})
    .then(r=>r.json()).then(res=>{ if(res && res.graduated) graduatedNow.push(c.w); }).catch(()=>{});
  idx++;
  render();
}
function endPass(){
  if (notLearned.length === 0 || pass >= MAX_PASSES){ finish(false); return; }
  pass++; deck = notLearned; notLearned = []; idx = 0;
  const t = document.getElementById('toast');
  t.textContent = '第 ' + pass + ' 轮：把没学会的 ' + deck.length + ' 个再过一遍';
  setTimeout(()=>{ t.textContent=''; }, 2200);
  render();
}
function finish(early){
  const leftover = notLearned.length + (early ? (deck.length - idx) : 0);
  document.getElementById('stage').classList.add('hidden');
  const done = document.getElementById('doneStage');
  done.classList.remove('hidden');
  document.getElementById('doneTitle').textContent = early ? '已提前结束' : '测试完成！';
  document.getElementById('doneMsg').textContent =
    '本次抽了 ' + startN + ' 个词，做了 ' + pass + ' 轮，还有 ' + leftover + ' 个没学会（已记录，下次优先出现）。';
  setTimeout(()=>{
    document.getElementById('gradMsg').textContent =
      graduatedNow.length ? ('🎓 ' + graduatedNow.length + ' 个词连续 3 次学会，毕业啦：' + [...new Set(graduatedNow)].join('、')) : '';
  }, 350);
}

document.addEventListener('keydown', e=>{
  if (document.getElementById('stage').classList.contains('hidden')) return;
  if (e.key===' '){ e.preventDefault(); reveal(); }
  else if (e.key==='ArrowLeft')  judge(false);
  else if (e.key==='ArrowRight') judge(true);
  else if (e.key.toLowerCase()==='s') speak();
});
</script>
</body></html>`;
}

function register(app, store) {
  app.get('/wordtest', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(page(weightedOrder(eligiblePool(store)), stats(store)));
  });

  app.post('/api/wordtest/mark', (req, res) => {
    const { word, learned } = req.body || {};
    if (!word) return res.status(400).json({ error: 'no word' });
    const prog = store.getKey('wordtest') || {};
    const p = prog[word] || { streak: 0, learned: 0, wrong: 0, lastTs: 0 };
    if (learned) { p.streak++; p.learned++; } else { p.streak = 0; p.wrong++; }
    p.lastTs = Date.now();
    prog[word] = p;
    store.setKey('wordtest', prog);
    res.json({ ok: true, streak: p.streak, graduated: p.streak >= GRADUATE_STREAK });
  });
}

module.exports = { register };
