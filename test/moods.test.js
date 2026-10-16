'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { moodKeywords, MOOD_KEYWORDS, KEYWORD_IDS } = require('../src/moods');
const { EMOTIONS } = require('../src/emotions');
const { pickMovies } = require('../src/picker');

test('every emotion has mood keywords, all with known TMDB ids', () => {
  for (const key of Object.keys(EMOTIONS)) {
    const mood = MOOD_KEYWORDS[key];
    assert.ok(mood && mood.look.length, `${key} has keywords to look for`);
    for (const name of [...mood.look, ...mood.avoid]) {
      assert.ok(Number.isInteger(KEYWORD_IDS[name]), `${key}: "${name}" has an id`);
    }
  }
});

test('combining emotions never avoids a keyword another emotion looks for', () => {
  const { look, avoid } = moodKeywords(['sad', 'bored']); // bored avoids "gentle", sad looks for it
  assert.ok(look.includes(KEYWORD_IDS.gentle));
  assert.ok(!avoid.includes(KEYWORD_IDS.gentle));
  assert.ok(avoid.includes(KEYWORD_IDS.tragedy), 'heavy themes are still avoided');
});

test('"match" mode keeps genre-only picks', () => {
  assert.deepStrictEqual(moodKeywords(['sad'], 'match'), { look: [], avoid: [] });
});

test('movies matching the mood keywords rank first and are flagged', () => {
  const catalogue = [
    ...[1, 2, 3, 4, 5, 6].map((id) => ({ id, title: `Comedy ${id}`, genres: ['Comedy'], rating: 8.5, year: 2000 })),
    { id: 10, title: 'Feel-good A', genres: ['Comedy'], rating: 6.5, year: 2000, moodFits: [0] },
    { id: 11, title: 'Feel-good B', genres: ['Drama'], rating: 6.5, year: 2001, moodFits: [0] },
  ];
  for (let i = 0; i < 20; i++) {
    const picks = pickMovies(catalogue, [['Comedy']], { count: 2 });
    assert.deepStrictEqual(picks.map((m) => m.title).sort(), ['Feel-good A', 'Feel-good B']);
    assert.ok(picks.every((m) => m.moodMatch === true && !('moodFits' in m)));
  }
});
