'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { detectEmotion, EMOTIONS } = require('../src/emotions');

test('detects a simple emotion', () => {
  assert.strictEqual(detectEmotion('I feel really sad today').emotion, 'sad');
  assert.strictEqual(detectEmotion('So STRESSED with work').emotion, 'stressed');
});

test('handles word variations', () => {
  assert.strictEqual(detectEmotion('I have been worrying all week').emotion, 'stressed');
});

test('picks the dominant emotion', () => {
  assert.strictEqual(detectEmotion('a bit bored but mostly tired, exhausted and sleepy').emotion, 'tired');
});

test('negation flips to the opposite emotion', () => {
  const result = detectEmotion("I'm not happy");
  assert.strictEqual(result.emotion, 'sad');
  assert.strictEqual(result.matched[0].negated, true);
});

test('returns null when no emotion is found', () => {
  assert.strictEqual(detectEmotion('the quick brown fox').emotion, null);
  assert.strictEqual(detectEmotion('').emotion, null);
});

test('every emotion has a valid opposite and genres', () => {
  for (const [key, e] of Object.entries(EMOTIONS)) {
    assert.ok(EMOTIONS[e.opposite], `${key} opposite ${e.opposite} exists`);
    assert.ok(e.match.length && e.lift.length, `${key} has genres`);
  }
});
