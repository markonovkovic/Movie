'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { compareTitles } = require('../src/sort');

test('A–Z: letters first (ignoring case, accents and leading symbols), then numbers in natural order', () => {
  const titles = ['2001: A Space Odyssey', 'Zootopia', '#Alive', '(500) Days of Summer', '"MANOS" The Hands of Fate',
    '12 Angry Men', 'amélie', 'Alien', 'The Matrix', '2 Fast 2 Furious', 'Éclair', 'Up'];
  assert.deepStrictEqual(titles.sort(compareTitles), [
    'Alien', '#Alive', 'amélie', 'Éclair', '"MANOS" The Hands of Fate', 'The Matrix', 'Up', 'Zootopia',
    '2 Fast 2 Furious', '12 Angry Men', '(500) Days of Summer', '2001: A Space Odyssey',
  ]);
});
