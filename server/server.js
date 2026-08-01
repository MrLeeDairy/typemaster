const express = require('express');
const path = require('path');
const store = require('./store');
const studymode = require('./studymode');
const dailylog = require('./dailylog');
const wordtest = require('./wordtest');

const app = express();
const PORT = process.env.PORT || 3210;

app.use(express.json({ limit: '2mb' }));

studymode.register(app);
dailylog.register(app, store);
wordtest.register(app, store);

// Only expose the frontend entry point and its assets — not the server
// source, package.json, or the data file — over HTTP.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

app.get('/api/store/:key', (req, res) => {
  const { key } = req.params;
  if (!store.ALLOWED_KEYS.includes(key)) return res.status(404).json({ error: 'unknown key' });
  res.json(store.getKey(key));
});

app.put('/api/store/:key', (req, res) => {
  const { key } = req.params;
  if (!store.ALLOWED_KEYS.includes(key)) return res.status(404).json({ error: 'unknown key' });
  store.setKey(key, req.body);
  if (key === 'daily') dailylog.archiveDaily(store, req.body); // snapshot into the dated archive
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Type2Memory running at http://localhost:${PORT}`);
});
