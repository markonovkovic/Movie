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
  await assert.rejects(recommend({}), /Pick an emotion/);
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

test('combines several emotions, covering each one', async () => {
  for (let i = 0; i < 25; i++) {
    const res = await recommend({ emotions: ['scared', 'curious'], mode: 'match' });
    assert.deepStrictEqual(res.emotions.map((e) => e.key), ['scared', 'curious']);
    assert.strictEqual(res.movies.length, 3);
    for (const key of ['scared', 'curious']) {
      const wanted = new Set(EMOTIONS[key].match);
      assert.ok(res.movies.some((m) => m.genres.some((g) => wanted.has(g))), `a pick fits ${key}`);
    }
  }
});

test('prefers movies that fit all chosen emotions', () => {
  const catalogue = [
    { id: 1, title: 'Only A', genres: ['Horror'], rating: 9 },
    { id: 2, title: 'Only B', genres: ['Romance'], rating: 9 },
    { id: 3, title: 'Both', genres: ['Horror', 'Romance'], rating: 6 },
    { id: 4, title: 'Neither', genres: ['War'], rating: 9 },
  ];
  const picks = pickMovies(catalogue, [['Horror'], ['Romance']], { count: 1, random: () => 0.5 });
  assert.deepStrictEqual(picks.map((m) => m.title), ['Both']);
});

test('accepts emotions as a list or comma-separated string, and merges with text', async () => {
  const fromString = await recommend({ emotions: 'Happy, loved' });
  assert.deepStrictEqual(fromString.emotions.map((e) => e.key), ['happy', 'loved']);
  assert.match(fromString.message, /happy and romantic/);

  const merged = await recommend({ emotions: ['tired'], text: 'also kind of lonely' });
  assert.deepStrictEqual(merged.emotions.map((e) => e.key), ['tired', 'lonely']);
  assert.strictEqual(merged.detectedFrom, 'text');

  const ignoredText = await recommend({ emotions: ['tired'], text: 'qwerty' });
  assert.deepStrictEqual(ignoredText.emotions.map((e) => e.key), ['tired']);

  const full = await recommend({ emotions: ['happy', 'sad', 'bored'], text: 'so lonely' });
  assert.deepStrictEqual(full.emotions.map((e) => e.key), ['happy', 'sad', 'bored']);
  assert.strictEqual(full.detectedFrom, 'selection');
  assert.strictEqual(full.matchedWords, undefined);

  await assert.rejects(recommend({ emotions: ['happy', 'sad', 'bored', 'tired'] }), /at most 3/);
  await assert.rejects(recommend({ emotions: 'happy' + ',nope' }), /Unknown emotion "nope"/);
});

test('never recommends movies rated below 6', () => {
  const catalogue = [
    { id: 1, title: 'Low', genres: ['Comedy'], rating: 5.9, year: 2024 },
    { id: 2, title: 'Unrated', genres: ['Comedy'], rating: null, year: 2024 },
    { id: 3, title: 'OK', genres: ['Comedy'], rating: 6, year: 2001 },
    { id: 4, title: 'Good', genres: ['Comedy'], rating: 8, year: 1999 },
  ];
  for (let i = 0; i < 20; i++) {
    const picks = pickMovies(catalogue, ['Comedy']);
    assert.deepStrictEqual(picks.map((m) => m.title).sort(), ['Good', 'OK']);
  }
});

test('one pick is the newest fitting movie, marked isNewest', async () => {
  const { MOVIES } = require('../src/movies');
  for (const key of Object.keys(EMOTIONS)) {
    const res = await recommend({ emotion: key });
    const newest = res.movies.filter((m) => m.isNewest);
    assert.strictEqual(newest.length, 1, `${key} has one newest pick`);
    const wanted = new Set(EMOTIONS[key].lift);
    const latest = Math.max(...MOVIES.filter((m) => m.genres.some((g) => wanted.has(g))).map((m) => m.year));
    assert.ok(newest[0].year >= latest - 1, `${key}: ${newest[0].title} (${newest[0].year}) is recent, latest is ${latest}`);
    assert.ok(res.movies.every((m) => m.rating >= 6));
  }
  // The shared catalogue is never modified.
  assert.ok(MOVIES.every((m) => !('isNewest' in m)));
});

test('the newest pick comes from newestPool when it has a fitting movie', () => {
  const catalogue = [1, 2, 3, 4].map((id) => ({ id, title: `Old ${id}`, genres: ['Drama'], rating: 8, year: 1990 + id }));
  const pool = [
    { id: 10, title: 'New but wrong genre', genres: ['Horror'], rating: 9, year: 2026 },
    { id: 11, title: 'New but low rated', genres: ['Drama'], rating: 5, year: 2026 },
    { id: 12, title: 'New and good', genres: ['Drama'], rating: 7, year: 2026 },
  ];
  const picks = pickMovies(catalogue, ['Drama'], { newestPool: pool });
  assert.strictEqual(picks.length, 3);
  assert.deepStrictEqual(picks.filter((m) => m.isNewest).map((m) => m.title), ['New and good']);
  assert.strictEqual(picks[0].title, 'New and good');
});
