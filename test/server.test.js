'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../server');

let server;
let base;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

test('GET /api/movies lists and filters movies', async () => {
  const all = await (await fetch(`${base}/api/movies`)).json();
  assert.ok(all.total > 100);
  const horror = await (await fetch(`${base}/api/movies?genre=Horror`)).json();
  assert.ok(horror.movies.every((m) => m.genres.includes('Horror')));
  const search = await (await fetch(`${base}/api/movies?q=inception`)).json();
  assert.strictEqual(search.movies[0].title, 'Inception');
});

test('POST /api/recommend returns 3 movies', async () => {
  const res = await fetch(`${base}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'I am bored out of my mind' }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.emotion.key, 'bored');
  assert.strictEqual(data.movies.length, 3);
});

test('GET /api/recommend works with query params', async () => {
  const data = await (await fetch(`${base}/api/recommend?emotion=happy&mode=match`)).json();
  assert.strictEqual(data.mode, 'match');
  assert.strictEqual(data.movies.length, 3);
  const multi = await (await fetch(`${base}/api/recommend?emotions=sad,loved`)).json();
  assert.deepStrictEqual(multi.emotions.map((e) => e.key), ['sad', 'loved']);
});

test('returns helpful errors', async () => {
  const bad = await fetch(`${base}/api/recommend`, { method: 'POST', body: '{not json' });
  assert.strictEqual(bad.status, 400);
  const unknown = await fetch(`${base}/api/recommend?emotion=nope`);
  assert.strictEqual(unknown.status, 400);
});

test('serves the frontend and blocks path traversal', async () => {
  const page = await fetch(`${base}/`);
  assert.match(await page.text(), /MoviePicker/);
  const traversal = await fetch(`${base}/..%2fserver.js`);
  assert.notStrictEqual(traversal.status, 200);
});

test('GET /healthz responds ok', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.deepStrictEqual(await res.json(), { ok: true });
});

test('GET /api/trailer without TMDB returns a YouTube search link', async () => {
  const data = await (await fetch(`${base}/api/trailer?title=Up&year=2009`)).json();
  assert.strictEqual(data.youtubeKey, null);
  assert.strictEqual(data.searchUrl, 'https://www.youtube.com/results?search_query=Up%202009%20trailer');
});
