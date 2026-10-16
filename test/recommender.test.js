'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { recommend, pickMovies } = require('../src/recommender');
const { EMOTIONS } = require('../src/emotions');
const { MOVIES } = require('../src/movies');

test('returns exactly 3 distinct movies for every emotion and mode', async () => {
  for (const key of Object.keys(EMOTIONS)) {
    for (const mode of ['lift', 'match']) {
      const res = await recommend({ emotion: key, mode });
      assert.strictEqual(res.movies.length, 3, `${key}/${mode}`);
      assert.strictEqual(new Set(res.movies.map((m) => m.id)).size, 3);
      const genres = new Set(EMOTIONS[key][mode]);
      for (const m of res.movies) {
        assert.ok(m.genres.some((g) => genres.has(g)), `${m.title} fits ${key}/${mode}`);
      }
    }
  }
});

test('detects emotion from free text', async () => {
  const res = await recommend({ text: 'I feel so lonely tonight' });
  assert.strictEqual(res.emotion.key, 'lonely');
  assert.strictEqual(res.detectedFrom, 'text');
  assert.deepStrictEqual(res.matchedWords, ['lonely']);
});

test('excludes already-seen movies', async () => {
  const first = await recommend({ emotion: 'sad' });
  const second = await recommend({ emotion: 'sad', exclude: first.movies.map((m) => m.id) });
  const firstIds = new Set(first.movies.map((m) => m.id));
  assert.ok(second.movies.every((m) => !firstIds.has(m.id)));
});

test('starts over when everything has been excluded', () => {
  const picks = pickMovies(MOVIES, ['Western'], { exclude: MOVIES.map((m) => m.id) });
  assert.strictEqual(picks.length, 3);
});

test('rejects unknown emotions and empty input', async () => {
  await assert.rejects(recommend({ emotion: 'hangry' }), /Unknown emotion/);
  await assert.rejects(recommend({}), /Provide/);
  await assert.rejects(recommend({ text: 'qwerty' }), (err) => err.status === 422);
});

test('uses an external source when provided and falls back on failure', async () => {
  const fake = [{ id: 1 }, { id: 2 }, { id: 3 }].map((m) => ({ ...m, title: 't', genres: ['Comedy'] }));
  const ok = await recommend({ emotion: 'happy' }, { source: async () => fake });
  assert.strictEqual(ok.source, 'tmdb');

  const orig = console.warn;
  console.warn = () => {};
  try {
    const failed = await recommend({ emotion: 'happy' }, { source: async () => { throw new Error('down'); } });
    assert.strictEqual(failed.source, 'local');
    assert.strictEqual(failed.movies.length, 3);
  } finally {
    console.warn = orig;
  }
});
