'use strict';

const { MOVIES } = require('./movies');
const { EMOTIONS, detectEmotion } = require('./emotions');

const DEFAULT_COUNT = 3;

class RecommendationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Works out which emotion to use from either an explicit key or free text.
 * An explicit, valid emotion key always wins over text.
 */
function resolveEmotion({ emotion, text } = {}) {
  if (emotion) {
    const key = String(emotion).toLowerCase();
    if (!EMOTIONS[key]) throw new RecommendationError(`Unknown emotion "${emotion}".`);
    return { key, detectedFrom: 'selection' };
  }
  if (text && String(text).trim()) {
    const result = detectEmotion(text);
    if (!result.emotion) {
      throw new RecommendationError(
        "Sorry, I couldn't tell how you feel from that. Try words like \"stressed\", \"happy\" or \"lonely\", or pick an emotion.",
        422,
      );
    }
    return { key: result.emotion, detectedFrom: 'text', matched: result.matched };
  }
  throw new RecommendationError('Provide an "emotion" or some "text" describing how you feel.');
}

function shuffle(items, random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks `count` movies from `catalogue` for the given genres.
 * Movies matching more of the target genres (and rated higher) are preferred,
 * with randomness so repeated requests give fresh suggestions.
 */
function pickMovies(catalogue, genres, { count = DEFAULT_COUNT, exclude = [], random = Math.random } = {}) {
  const excluded = new Set(exclude.map(Number));
  const wanted = new Set(genres);

  let candidates = catalogue
    .filter((m) => !excluded.has(m.id))
    .map((m) => ({ movie: m, overlap: m.genres.filter((g) => wanted.has(g)).length }))
    .filter((c) => c.overlap > 0);

  // If the user has already seen everything, start over rather than return nothing.
  if (candidates.length < count && excluded.size) {
    return pickMovies(catalogue, genres, { count, random });
  }

  // Weighted random: overlap and rating raise the odds without making picks deterministic.
  candidates = candidates.map((c) => ({
    ...c,
    weight: c.overlap * 2 + (c.movie.rating || 5) / 2 + random() * 4,
  }));
  candidates.sort((a, b) => b.weight - a.weight);

  // Take the strongest few, then make sure the three aren't all from one genre if avoidable.
  const pool = shuffle(candidates.slice(0, Math.max(count * 4, 12)), random);
  const picks = [];
  const usedPrimary = new Set();
  for (const c of pool) {
    if (picks.length === count) break;
    const primary = c.movie.genres.find((g) => wanted.has(g));
    if (!usedPrimary.has(primary)) {
      picks.push(c.movie);
      usedPrimary.add(primary);
    }
  }
  for (const c of pool) {
    if (picks.length === count) break;
    if (!picks.includes(c.movie)) picks.push(c.movie);
  }
  return picks;
}

/**
 * Main entry point.
 * @param {object} input  { emotion?, text?, mode?: 'lift'|'match', exclude?: number[], count? }
 * @param {object} deps   { source?: async (genres, opts) => movies[], random? }
 */
async function recommend(input = {}, deps = {}) {
  const mode = input.mode === 'match' ? 'match' : 'lift';
  const count = Math.min(Math.max(parseInt(input.count, 10) || DEFAULT_COUNT, 1), 10);
  const exclude = Array.isArray(input.exclude) ? input.exclude : [];
  const random = deps.random || Math.random;

  const resolved = resolveEmotion(input);
  const emotion = EMOTIONS[resolved.key];
  const genres = emotion[mode];

  let movies = null;
  let source = 'local';
  if (deps.source) {
    try {
      movies = await deps.source(genres, { count, exclude, random });
      if (movies && movies.length) source = 'tmdb';
    } catch (err) {
      // Fall back to the built-in catalogue if the external API fails.
      console.warn(`[recommend] external source failed, using local catalogue: ${err.message}`);
    }
  }
  if (!movies || !movies.length) {
    movies = pickMovies(MOVIES, genres, { count, exclude, random });
  }

  return {
    emotion: { key: resolved.key, label: emotion.label, emoji: emotion.emoji },
    detectedFrom: resolved.detectedFrom,
    matchedWords: resolved.matched ? resolved.matched.map((m) => m.word) : undefined,
    mode,
    genres,
    message: mode === 'match' ? `Movies that match feeling ${emotion.label.toLowerCase()}.` : emotion.message,
    source,
    movies,
  };
}

module.exports = { recommend, pickMovies, resolveEmotion, RecommendationError };
