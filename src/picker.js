'use strict';

const DEFAULT_COUNT = 3;
const MIN_RATING = 6; // never recommend movies rated below this
const NEWEST_CHOICES = 5; // the newest pick is random among this many best-fitting recent movies

function shuffle(items, random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Random choice among the best few, limited to those fitting the most emotions.
function randomTop(scored, random, n = NEWEST_CHOICES) {
  if (!scored.length) return undefined;
  const mostFits = Math.max(...scored.map((c) => c.rank));
  const top = scored.filter((c) => c.rank === mostFits).slice(0, n);
  return top[Math.floor(random() * top.length)];
}

const isGoodEnough = (m, minRating) => typeof m.rating === 'number' && m.rating >= minRating;

// Scores movies against the emotions' genre sets and any required genres.
// `m.moodFits` (optional) lists the emotions (by index) whose mood keywords the movie has,
// e.g. "hopeful" or "feel-good" for sad; those count as fitting the emotion and rank higher.
// Movies fitting no emotion are dropped, unless the user asked for specific genres.
function score(movies, sets, random, required = new Set()) {
  const wanted = new Set(sets.flatMap((s) => [...s]));
  return movies
    .map((m) => {
      const moodFits = m.moodFits || [];
      const fits = sets.map((s, i) => m.genres.some((g) => s.has(g)) || moodFits.includes(i));
      const fitCount = fits.filter(Boolean).length;
      // Genre matches counted per emotion, so a romantic comedy beats a plain comedy for "romantic + scared".
      const fitScore = sets.reduce((sum, set) => sum + m.genres.filter((g) => set.has(g)).length, 0);
      // A movie matching more of the requested genres (e.g. both action and comedy) ranks higher.
      const requiredScore = m.genres.filter((g) => required.has(g)).length;
      // Weighted random: fitting more emotions, more genres and a higher rating all raise the odds.
      const weight = fitCount * 3 + fitScore + requiredScore * 2 + moodFits.length * 5 + m.rating / 2 + random() * 4;
      // For the newest pick: fitting more emotions first, then mood-keyword matches.
      const rank = fitCount * 2 + (moodFits.length ? 1 : 0);
      return { movie: m, fits, fitCount, rank, weight, primary: m.genres.find((g) => wanted.has(g)) };
    })
    .filter((c) => c.fitCount > 0 || required.size > 0)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Picks `count` movies rated at least `minRating`.
 *
 * `genreSets` has one genre list per emotion, e.g. [['Comedy', 'Family'], ['Romance']]
 * for two emotions (a single flat list is treated as one emotion; it may be empty).
 * `required` genres, when given, are a hard rule: every pick has at least one of them. Movies that fit
 * more of the emotions rank higher, every emotion gets at least one fitting movie when
 * possible, and randomness keeps repeated requests fresh.
 *
 * One pick is reserved for a recent release, marked `isNewest: true`: a random one of the
 * best-fitting few in `newestPool` (e.g. movies released in the last year), otherwise
 * from the most recent fitting movies in `catalogue`.
 */
function pickMovies(catalogue, genreSets, {
  count = DEFAULT_COUNT, exclude = [], random = Math.random, minRating = MIN_RATING, newestPool = [], required = [],
} = {}) {
  const sets = (typeof genreSets[0] === 'string' ? [genreSets] : genreSets).map((s) => new Set(s));
  const requiredSet = new Set(required);
  const excluded = new Set(exclude.map(Number));
  // Requested genres are a hard rule. With several (e.g. "romcom"), movies having all of them
  // are used when there are enough; otherwise any one of them is enough.
  const hasAll = (m) => required.every((g) => m.genres.includes(g));
  const hasAny = (m) => !requiredSet.size || m.genres.some((g) => requiredSet.has(g));
  const usable = (list, match = hasAny) => list.filter((m) => !excluded.has(m.id) && isGoodEnough(m, minRating) && match(m));
  const strict = required.length > 1 && usable(catalogue, hasAll).length >= count;
  const match = strict ? hasAll : hasAny;

  const candidates = score(usable(catalogue, match), sets, random, requiredSet);
  const picks = [];
  const pickedIds = new Set();
  const take = (c) => { picks.push(c.movie); pickedIds.add(c.movie.id); };
  const taken = (c) => pickedIds.has(c.movie.id);

  // 1. The newest pick: one of the best fits among recent releases, chosen at random
  //    so the same film doesn't come up every time.
  let newest = randomTop(score(usable(newestPool, match), sets, random, requiredSet), random);
  if (!newest && candidates.length) {
    const latestYear = Math.max(...candidates.map((c) => c.movie.year || 0));
    newest = randomTop(candidates.filter((c) => (c.movie.year || 0) >= latestYear - 1), random);
  }
  if (newest && count > 0) take(newest);
  const newestId = newest && newest.movie.id;

  // 2. Make sure every emotion is represented (one pick often covers several).
  const covered = sets.map((_, i) => Boolean(newest && newest.fits[i]));
  for (let i = 0; i < sets.length && picks.length < count; i++) {
    if (covered[i]) continue;
    const best = candidates.find((c) => c.fits[i] && !taken(c));
    if (!best) continue;
    take(best);
    best.fits.forEach((f, j) => { if (f) covered[j] = true; });
  }

  // 3. Fill the rest from the strongest few, preferring a different main genre each time.
  //    Shuffled only among equally strong candidates, so mood matches stay ahead.
  const top = candidates.slice(0, Math.max(count * 4, 12));
  const pool = [...new Set(top.map((c) => c.rank))].sort((a, b) => b - a)
    .flatMap((rank) => shuffle(top.filter((c) => c.rank === rank), random));
  const usedPrimary = new Set(picks.map((m) => m.genres.find((g) => sets.some((s) => s.has(g)))));
  for (const c of pool) {
    if (picks.length === count) break;
    if (!taken(c) && !usedPrimary.has(c.primary)) {
      take(c);
      usedPrimary.add(c.primary);
    }
  }
  for (const c of [...pool, ...candidates]) {
    if (picks.length === count) break;
    if (!taken(c)) take(c);
  }

  // Not enough unseen movies left: top up with ones shown before rather than return fewer.
  if (picks.length < count && excluded.size) {
    for (const m of pickMovies(catalogue, genreSets, { count, random, minRating, newestPool, required })) {
      if (picks.length === count) break;
      if (!pickedIds.has(m.id)) { picks.push(m); pickedIds.add(m.id); }
    }
  }

  // Copies, so the shared catalogue objects are never modified. Top-ups may carry their
  // own isNewest flag from the nested call, so it is reset for everything but our pick.
  return picks.map(({ isNewest, moodFits, ...m }) => {
    const out = moodFits && moodFits.length ? { ...m, moodMatch: true } : m;
    return m.id === newestId ? { ...out, isNewest: true } : out;
  });
}

module.exports = { pickMovies, shuffle, DEFAULT_COUNT, MIN_RATING };
