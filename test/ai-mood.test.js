'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createAiMoodDetector, OUTPUT_SCHEMA } = require('../src/ai-mood');
const { recommend } = require('../src/recommender');
const { EMOTIONS } = require('../src/emotions');

// Minimal stand-in for the Anthropic client that records the request.
function fakeClient(reply, calls = []) {
  return {
    beta: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return typeof reply === 'function' ? reply(params) : reply;
        },
      },
    },
  };
}
const textReply = (obj) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] });

test('sends a schema-constrained request and parses the result', async () => {
  const calls = [];
  const detect = createAiMoodDetector({ client: fakeClient(textReply({ emotions: ['stressed', 'scared'], reason: 'You sound swamped.' }), calls) });
  const result = await detect('my boss yelled at me and I want to hide');
  assert.deepStrictEqual(result, { emotions: ['stressed', 'scared'], reason: 'You sound swamped.' });
  const req = calls[0];
  assert.strictEqual(req.model, 'claude-opus-5-5');
  assert.strictEqual(req.output_config.format.type, 'json_schema');
  assert.deepStrictEqual(OUTPUT_SCHEMA.properties.emotions.items.enum, Object.keys(EMOTIONS));
  assert.strictEqual(req.messages[0].content, 'my boss yelled at me and I want to hide');
});

test('handles no emotion, duplicates, refusals and bad output', async () => {
  const none = createAiMoodDetector({ client: fakeClient(textReply({ emotions: [], reason: '' })) });
  assert.deepStrictEqual((await none('what time is it')).emotions, []);
  const many = createAiMoodDetector({ client: fakeClient(textReply({ emotions: ['sad', 'sad', 'lonely', 'tired', 'bored'], reason: '' })) });
  assert.deepStrictEqual((await many('x')).emotions, ['sad', 'lonely', 'tired']);
  const refused = createAiMoodDetector({ client: fakeClient({ stop_reason: 'refusal', content: [] }) });
  await assert.rejects(refused('x'), /declined/);
  const bogus = createAiMoodDetector({ client: fakeClient(textReply({ emotions: ['hangry'], reason: '' })) });
  await assert.rejects(bogus('x'), /Unexpected emotion/);
});

test('recommend uses AI detection, and falls back to keywords when it fails', async () => {
  const ai = await recommend({ text: 'ugh, today was a lot' }, { detectMood: async () => ({ emotions: ['tired', 'stressed'], reason: 'You sound worn out.' }) });
  assert.deepStrictEqual(ai.emotions.map((e) => e.key), ['tired', 'stressed']);
  assert.strictEqual(ai.detectedFrom, 'ai');
  assert.strictEqual(ai.reason, 'You sound worn out.');

  const orig = console.warn;
  console.warn = () => {};
  try {
    const fallback = await recommend({ text: 'I feel lonely' }, { detectMood: async () => { throw new Error('network'); } });
    assert.strictEqual(fallback.emotion.key, 'lonely');
    assert.strictEqual(fallback.detectedFrom, 'text');
  } finally {
    console.warn = orig;
  }

  await assert.rejects(
    recommend({ text: 'what time is it' }, { detectMood: async () => ({ emotions: [] }) }),
    (err) => err.status === 422,
  );
  const picked = await recommend({ emotion: 'happy' }, { detectMood: async () => { throw new Error('should not be called'); } });
  assert.strictEqual(picked.detectedFrom, 'selection');
});
