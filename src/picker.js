'use strict';

const DEFAULT_COUNT = 3;

function shuffle(items, random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks `count` movies from `catalogue`.
 *
 * `genreSets` has one genre list per emotion, e.g. [['Comedy', 'Family'], ['Romance']]
 * for two emotions (a single flat list is treated as one emotion). Movies that fit
 * more of the emotions rank higher, every emotion gets at least one fitting movie when
 * possible, and randomness keeps repeated requests fresh.
 */
function pickMovies(catalogue, genreSets, { count = DEFAULT_COUNT, exclude = [], random = Math.random } = {}) {
  const sets = (typeof genreSets[0] === 'string' ? [genreSets] : genreSets).map((s) => new Set(s));
  const wanted = new Set(sets.flatMap((s) => [...s]));
  const excluded = new Set(exclude.map(Number));

  let candidates = catalogue
    .filter((m) => !excluded.has(m.id))
    .map((m) => {
      const fits = sets.map((s) => m.genres.some((g) => s.has(g)));
      return {
        movie: m,
        fits,
        fitCount: fits.filter(Boolean).length,
        // Genre matches counted per emotion, so a romantic comedy beats a plain comedy for "romantic + scared".
        fitScore: sets.reduce((sum, set) => sum + m.genres.filter((g) => set.has(g)).length, 0),
      };
    })
    .filter((c) => c.fitCount > 0);

  // Weighted random: fitting more emotions, more genres and a higher rating all raise the odds.
  candidates = candidates
    .map((c) => ({ ...c, weight: c.fitCount * 3 + c.fitScore + (c.movie.rating || 5) / 2 + random() * 4 }))
    .sort((a, b) => b.weight - a.weight);

  const picks = [];
  const take = (c) => picks.push(c.movie);
  const taken = (c) => picks.includes(c.movie);

  // 1. Make sure every emotion is represented (one pick often covers several).
  const covered = sets.map(() => false);
  for (let i = 0; i < sets.length && picks.length < count; i++) {
    if (covered[i]) continue;
    const best = candidates.find((c) => c.fits[i] && !taken(c));
    if (!best) continue;
    take(best);
    best.fits.forEach((f, j) => { if (f) covered[j] = true; });
  }

  // 2. Fill the rest from the strongest few, preferring a different main genre each time.
  const pool = shuffle(candidates.slice(0, Math.max(count * 4, 12)), random);
  const primaryOf = (m) => m.genres.find((g) => wanted.has(g));
  const usedPrimary = new Set(picks.map(primaryOf));
  for (const c of pool) {
    if (picks.length === count) break;
    if (!taken(c) && !usedPrimary.has(primaryOf(c.movie))) {
      take(c);
      usedPrimary.add(primaryOf(c.movie));
    }
  }
  for (const c of [...pool, ...candidates]) {
    if (picks.length === count) break;
    if (!taken(c)) take(c);
  }

  // Not enough unseen movies left: top up with ones shown before rather than return fewer.
  if (picks.length < count && excluded.size) {
    for (const m of pickMovies(catalogue, genreSets, { count, random })) {
      if (picks.length === count) break;
      if (!picks.includes(m)) picks.push(m);
    }
  }
  return picks;
}

module.exports = { pickMovies, shuffle, DEFAULT_COUNT };
