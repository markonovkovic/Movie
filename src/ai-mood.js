'use strict';

// Optional AI mood detection with Claude. Enabled when ANTHROPIC_API_KEY is set.
// Understands any phrasing ("my boss yelled at me and I just want to hide"),
// slang, other languages and emoji. Falls back to keyword detection on any failure.

const Anthropic = require('@anthropic-ai/sdk');
const { EMOTIONS } = require('./emotions');

const DEFAULT_MODEL = 'claude-opus-5-5';
const EMOTION_KEYS = Object.keys(EMOTIONS);

const SYSTEM_PROMPT = `You classify how a person feels, for a movie recommendation app.
Read the user's message (any language, slang or emoji) and list the emotions from the list below that describe how they feel right now, strongest first.
Usually one emotion is right; list two or three only when the message clearly expresses mixed feelings.
Return an empty list only if the message says nothing about their feelings or state of mind.
The "reason" is shown to the user: one short, friendly sentence in English, addressed to them ("You sound…").

Emotions:
${EMOTION_KEYS.map((k) => `- ${k}: ${EMOTIONS[k].label}`).join('\n')}`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    emotions: { type: 'array', items: { type: 'string', enum: EMOTION_KEYS } },
    reason: { type: 'string' },
  },
  required: ['emotions', 'reason'],
  additionalProperties: false,
};

function createAiMoodDetector({ apiKey, model = DEFAULT_MODEL, client } = {}) {
  const anthropic = client || new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });

  /** Returns { emotions: [up to 3 keys, strongest first], reason }; emotions is empty when no feeling is expressed. */
  return async function detectWithAi(text) {
    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: String(text).slice(0, 500) }],
    });

    if (response.stop_reason === 'refusal') throw new Error('Claude declined to classify this text');
    const block = response.content.find((b) => b.type === 'text');
    if (!block) throw new Error(`No text in response (stop_reason: ${response.stop_reason})`);
    const result = JSON.parse(block.text);
    if (!Array.isArray(result.emotions)) throw new Error('Response has no emotions list');
    const unexpected = result.emotions.find((e) => !EMOTIONS[e]);
    if (unexpected) throw new Error(`Unexpected emotion "${unexpected}"`);
    return { emotions: [...new Set(result.emotions)].slice(0, 3), reason: result.reason };
  };
}

module.exports = { createAiMoodDetector, OUTPUT_SCHEMA, DEFAULT_MODEL };
