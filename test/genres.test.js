'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseGenres, ALL_GENRES } = require('../src/genres');

test('understands genre names and everyday words', () => {
  const cases = {
    'sci-fi': ['Sci-Fi'],
    'Science Fiction': ['Sci-Fi'],
    'something funny with aliens': ['Comedy', 'Sci-Fi'],
    'scary movie': ['Horror'],
    romcom: ['Romance', 'Comedy'],
    'rom-com': ['Romance', 'Comedy'],
    'a funny animated cartoon for kids': ['Comedy', 'Animation', 'Family'],
    'true story about boxing': ['Biography', 'Sport'],
    'Horror, Comedy': ['Horror', 'Comedy'],
    'WESTERN': ['Western'],
  };
  for (const [text, expected] of Object.entries(cases)) {
    assert.deepStrictEqual(parseGenres(text).genres, expected, text);
  }
});

test('returns nothing for unrelated text and does not match inside words', () => {
  assert.deepStrictEqual(parseGenres('qwerty').genres, []);
  assert.deepStrictEqual(parseGenres('').genres, []);
  assert.deepStrictEqual(parseGenres('warm cozy evening').genres, [], '"war" inside "warm" is not War');
});

test('every genre name maps to itself', () => {
  for (const g of ALL_GENRES) assert.ok(parseGenres(g).genres.includes(g), g);
});
