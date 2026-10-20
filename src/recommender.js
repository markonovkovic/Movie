'use strict';

const { MOVIES } = require('./movies');
const { EMOTIONS, detectEmotion } = require('./emotions');
const { pickMovies, DEFAULT_COUNT, MIN_YEAR } = require('./picker');
const { parseGenres, ALL_GENRES } = require('./genres');

const MAX_EMOTIONS = 3;
const LENGTH_LABELS = { short: 'Under 90 min', medium: 'Under 2 hours', long: 'Long (2h+)' };

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
const GENRE_NOT_UNDERSTOOD = "Sorry, I don't know that genre. Try words like \"comedy\", \"sci-fi\", \"scary\" or \"romcom\".";

/**
 * Genres the user asked for: a list (`genres: ['Comedy']` or 'Comedy,Horror') and/or
 * free text (`genre: "something funny with aliens"`). Returns { genres, matched }.
 */
function resolveGenres({ genres, genre } = {}) {
  let list = genres ?? [];
  if (typeof list === 'string') list = list.split(',');
  if (!Array.isArray(list)) throw new RecommendationError('"genres" must be a list of genre names.');
  const byLower = new Map(ALL_GENRES.map((g) => [g.toLowerCase(), g]));
  const named = list.map((g) => String(g).trim()).filter(Boolean).map((g) => {
    const known = byLower.get(g.toLowerCase());
    if (!known) throw new RecommendationError(`Unknown genre "${g}".`);
    return known;
  });

  const text = genre ? String(genre).trim() : '';
  const parsed = text ? parseGenres(text) : { genres: [], matched: [] };
  if (text && !parsed.genres.length && !named.length) throw new RecommendationError(GENRE_NOT_UNDERSTOOD, 422);
  return { genres: [...new Set([...named, ...parsed.genres])], matched: parsed.matched };
}

async function resolveEmotions(input = {}, { detectMood } = {}, { optional = false } = {}) {
  const selected = parseSelected(input);
  const text = input.text ? String(input.text).trim() : '';
  if (!selected.length && !text) {
    if (optional) return { keys: [], detectedFrom: 'none' };
    throw new RecommendationError('Pick an emotion or type a genre.');
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
 * @param {object} input  { emotions?: string[], emotion?, text?, mode?: 'lift'|'match', count?,
 *                          exclude?: number[] (shown before: skipped when possible),
 *                          hide?: number[] (seen it / favourites: never picked) }
 * @param {object} deps   { source?: async (genreSets, opts) => movies[], detectMood?: async (text) => {emotions, reason}, random? }
 */
async function recommend(input = {}, deps = {}) {
  const mode = input.mode === 'match' ? 'match' : 'lift';
  const count = Math.min(Math.max(parseInt(input.count, 10) || DEFAULT_COUNT, 1), 10);
  const exclude = Array.isArray(input.exclude) ? input.exclude : [];
  const hide = Array.isArray(input.hide) ? input.hide : [];
  // Optional "how much time do you have?": short (≤90 min), medium (≤2h) or long (2h+).
  // Needs run-times, so it applies to TMDB picks; the built-in list has none and ignores it.
  const length = input.length || undefined;
  if (length && !LENGTH_LABELS[length]) throw new RecommendationError(`Unknown length "${input.length}".`);
  const random = deps.random || Math.random;

  const requested = resolveGenres(input);
  const resolved = await resolveEmotions(input, deps, { optional: requested.genres.length > 0 });
  const required = requested.genres;
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
      movies = await deps.source(genreSets, { count, exclude, hide, random, required, emotions: resolved.keys, mode, length });
      if (movies && movies.length) source = 'tmdb';
    } catch (err) {
      // Fall back to the built-in catalogue if the external API fails.
      console.warn(`[recommend] external source failed, using local catalogue: ${err.message}`);
    }
  }
  if (!movies || !movies.length) {
    // Built-in list: recent films (MIN_YEAR on) first; it is small, so older ones fill any gap.
    movies = pickMovies(MOVIES, genreSets, { count, exclude, hide, random, required, minYear: MIN_YEAR });
    if (movies.length < count) {
      const ids = new Set(movies.map((m) => m.id));
      const older = pickMovies(MOVIES, genreSets, { count, exclude: [...exclude, ...ids], hide, random, required })
        .filter((m) => !ids.has(m.id)).map(({ isNewest, ...m }) => m);
      movies = [...movies, ...older].slice(0, count);
    }
  }

  const labels = chosen.map((e) => e.label.toLowerCase());
  const genreLabel = required.length ? joinLabels(required) : '';
  let message;
  if (!chosen.length) {
    message = `Top ${genreLabel} picks.`;
  } else if (genreLabel) {
    message = mode === 'match'
      ? `${genreLabel} movies that match feeling ${joinLabels(labels)}.`
      : `${genreLabel} movies picked for feeling ${joinLabels(labels)}.`;
  } else if (chosen.length === 1) {
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
    requestedGenres: required,
    length: length ? { key: length, label: LENGTH_LABELS[length] } : undefined,
    matchedGenreWords: requested.matched.length ? requested.matched : undefined,
    message,
    source,
    movies,
  };
}

module.exports = { recommend, pickMovies, resolveEmotions, resolveGenres, RecommendationError, MAX_EMOTIONS };
