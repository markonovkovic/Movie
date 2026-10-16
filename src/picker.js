'use strict';

const DEFAULT_COUNT = 3;
const MIN_RATING = 6; // never recommend movies rated below this

function shuffle(items, random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const isGoodEnough = (m, minRating) => typeof m.rating === 'number' && m.rating >= minRating;

// Scores movies against the emotions' genre sets; movies fitting none are dropped.
function score(movies, sets, random) {
  const wanted = new Set(sets.flatMap((s) => [...s]));
  return movies
    .map((m) => {
      const fits = sets.map((s) => m.genres.some((g) => s.has(g)));
      const fitCount = fits.filter(Boolean).length;
      // Genre matches counted per emotion, so a romantic comedy beats a plain comedy for "romantic + scared".
      const fitScore = sets.reduce((sum, set) => sum + m.genres.filter((g) => set.has(g)).length, 0);
      // Weighted random: fitting more emotions, more genres and a higher rating all raise the odds.
      const weight = fitCount * 3 + fitScore + m.rating / 2 + random() * 4;
      return { movie: m, fits, fitCount, weight, primary: m.genres.find((g) => wanted.has(g)) };
    })
    .filter((c) => c.fitCount > 0)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Picks `count` movies rated at least `minRating`.
 *
 * `genreSets` has one genre list per emotion, e.g. [['Comedy', 'Family'], ['Romance']]
 * for two emotions (a single flat list is treated as one emotion). Movies that fit
 * more of the emotions rank higher, every emotion gets at least one fitting movie when
 * possible, and randomness keeps repeated requests fresh.
 *
 * One pick is reserved for a recent release, marked `isNewest: true`. It comes from
 * `newestPool` (e.g. movies released in the last year) when that has a fitting movie,
 * otherwise from the most recent fitting movies in `catalogue`.
 */
function pickMovies(catalogue, genreSets, {
  count = DEFAULT_COUNT, exclude = [], random = Math.random, minRating = MIN_RATING, newestPool = [],
} = {}) {
  const sets = (typeof genreSets[0] === 'string' ? [genreSets] : genreSets).map((s) => new Set(s));
  const excluded = new Set(exclude.map(Number));
  const usable = (list) => list.filter((m) => !excluded.has(m.id) && isGoodEnough(m, minRating));

  const candidates = score(usable(catalogue), sets, random);
  const picks = [];
  const pickedIds = new Set();
  const take = (c) => { picks.push(c.movie); pickedIds.add(c.movie.id); };
  const taken = (c) => pickedIds.has(c.movie.id);

  // 1. The newest pick: best fit among recent releases.
  let newest = score(usable(newestPool), sets, random).find((c) => !taken(c));
  if (!newest && candidates.length) {
    const latestYear = Math.max(...candidates.map((c) => c.movie.year || 0));
    newest = candidates.find((c) => (c.movie.year || 0) >= latestYear - 1);
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
  const pool = shuffle(candidates.slice(0, Math.max(count * 4, 12)), random);
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
    for (const m of pickMovies(catalogue, genreSets, { count, random, minRating, newestPool })) {
      if (picks.length === count) break;
      if (!pickedIds.has(m.id)) { picks.push(m); pickedIds.add(m.id); }
    }
  }

  // Copies, so the shared catalogue objects are never modified. Top-ups may carry their
  // own isNewest flag from the nested call, so it is reset for everything but our pick.
  return picks.map(({ isNewest, ...m }) => (m.id === newestId ? { ...m, isNewest: true } : m));
}

module.exports = { pickMovies, shuffle, DEFAULT_COUNT, MIN_RATING };
