'use strict';

const { MOVIES } = require('./movies');
const { EMOTIONS, detectEmotion } = require('./emotions');
const { pickMovies, DEFAULT_COUNT } = require('./picker');

const MAX_EMOTIONS = 3;

class RecommendationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const NOT_UNDERSTOOD = "Sorry, I couldn't tell how you feel from that. Try describing your mood, e.g. \"stressed\", \"happy\" or \"lonely\", or pick an emotion.";

// Accepts `emotions: ['sad', 'loved']`, `emotions: 'sad,loved'` or the older `emotion: 'sad'`.
function parseSelected({ emotion, emotions } = {}) {
  let list = emotions ?? (emotion ? [emotion] : []);
  if (typeof list === 'string') list = list.split(',');
  if (!Array.isArray(list)) throw new RecommendationError('"emotions" must be a list of emotion keys.');
  const keys = [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  for (const key of keys) {
    if (!EMOTIONS[key]) throw new RecommendationError(`Unknown emotion "${key}".`);
  }
  if (keys.length > MAX_EMOTIONS) throw new RecommendationError(`Pick at most ${MAX_EMOTIONS} emotions.`);
  return keys;
}

// Detects emotions in free text: AI first when configured, keywords as the fallback.
async function detectFromText(text, detectMood) {
  if (detectMood) {
    try {
      const ai = await detectMood(text);
      return { keys: ai.emotions, detectedFrom: 'ai', reason: ai.reason };
    } catch (err) {
      console.warn(`[recommend] AI mood detection failed, using keywords: ${err.message}`);
    }
  }
  const result = detectEmotion(text);
  return { keys: result.emotions, detectedFrom: 'text', matched: result.matched };
}

/**
 * Works out which emotions to use from the selected buttons and/or free text.
 * Both can be combined; text that can't be understood is an error only when
 * nothing was selected.
 */
async function resolveEmotions(input = {}, { detectMood } = {}) {
  const selected = parseSelected(input);
  const text = input.text ? String(input.text).trim() : '';
  if (!selected.length && !text) {
    throw new RecommendationError('Pick an emotion or describe how you feel.');
  }
  if (!text) return { keys: selected, detectedFrom: 'selection' };

  const detected = await detectFromText(text, detectMood);
  if (!detected.keys.length && !selected.length) throw new RecommendationError(NOT_UNDERSTOOD, 422);
  const keys = [...new Set([...selected, ...detected.keys])].slice(0, MAX_EMOTIONS);
  const added = detected.keys.filter((k) => keys.includes(k) && !selected.includes(k));
  if (!added.length) return { keys, detectedFrom: 'selection' }; // the text added nothing new
  return {
    ...detected,
    keys,
    matched: detected.matched && detected.matched.filter((m) => added.includes(m.emotion)),
  };
}

function joinLabels(labels) {
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}` : labels[0];
}

/**
 * Main entry point.
 * @param {object} input  { emotions?: string[], emotion?, text?, mode?: 'lift'|'match', exclude?: number[], count? }
 * @param {object} deps   { source?: async (genreSets, opts) => movies[], detectMood?: async (text) => {emotions, reason}, random? }
 */
async function recommend(input = {}, deps = {}) {
  const mode = input.mode === 'match' ? 'match' : 'lift';
  const count = Math.min(Math.max(parseInt(input.count, 10) || DEFAULT_COUNT, 1), 10);
  const exclude = Array.isArray(input.exclude) ? input.exclude : [];
  const random = deps.random || Math.random;

  const resolved = await resolveEmotions(input, deps);
  const chosen = resolved.keys.map((key) => ({ key, ...EMOTIONS[key] }));
  const genreSets = chosen.map((e) => e[mode]);

  // Genres wanted by more of the chosen emotions come first.
  const genreVotes = new Map();
  genreSets.flat().forEach((g) => genreVotes.set(g, (genreVotes.get(g) || 0) + 1));
  const genres = [...genreVotes.keys()].sort((a, b) => genreVotes.get(b) - genreVotes.get(a));

  let movies = null;
  let source = 'local';
  if (deps.source) {
    try {
      movies = await deps.source(genreSets, { count, exclude, random });
      if (movies && movies.length) source = 'tmdb';
    } catch (err) {
      // Fall back to the built-in catalogue if the external API fails.
      console.warn(`[recommend] external source failed, using local catalogue: ${err.message}`);
    }
  }
  if (!movies || !movies.length) {
    movies = pickMovies(MOVIES, genreSets, { count, exclude, random });
  }

  const labels = chosen.map((e) => e.label.toLowerCase());
  let message;
  if (chosen.length === 1) {
    message = mode === 'match' ? `Movies that match feeling ${labels[0]}.` : chosen[0].message;
  } else {
    message = mode === 'match'
      ? `A mix that matches feeling ${joinLabels(labels)}.`
      : `A mix picked for feeling ${joinLabels(labels)}.`;
  }

  const summary = chosen.map((e) => ({ key: e.key, label: e.label, emoji: e.emoji }));
  return {
    emotions: summary,
    emotion: summary[0], // first emotion, kept for older clients
    detectedFrom: resolved.detectedFrom,
    matchedWords: resolved.matched ? resolved.matched.map((m) => m.word) : undefined,
    reason: resolved.reason,
    mode,
    genres,
    message,
    source,
    movies,
  };
}

module.exports = { recommend, pickMovies, resolveEmotions, RecommendationError, MAX_EMOTIONS };
