'use strict';

// Integration with The Movie Database (https://www.themoviedb.org/).
// Enabled when TMDB_API_KEY is set; gives access to their full catalogue
// for both recommendations and the "All movies" list.
// Accepts either a v3 "API Key" or a v4 "API Read Access Token".

const { pickMovies, MIN_RATING } = require('./picker');
const { moodKeywords } = require('./moods');
const { compareTitles } = require('./sort');

const API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const MAX_PAGE = 500; // TMDB never returns pages beyond 500

const GENRE_IDS = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878,
  Thriller: 53, War: 10752, Western: 37,
};
const GENRE_NAMES = Object.fromEntries(Object.entries(GENRE_IDS).map(([name, id]) => [id, name]));
const GENRES = Object.keys(GENRE_IDS).sort();

// Sort options for browsing. Vote-count floors keep obscure, barely-rated titles out.
const BROWSE_SORTS = {
  popularity: { sort_by: 'popularity.desc' },
  rating: { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 },
  year: { sort_by: 'primary_release_date.desc', 'vote_count.gte': 50 },
};

function toMovie(m) {
  const genres = m.genre_ids
    ? m.genre_ids.map((id) => GENRE_NAMES[id])
    : (m.genres || []).map((g) => GENRE_NAMES[g.id]);
  return {
    id: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    genres: genres.filter(Boolean),
    rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
    description: m.overview,
    poster: m.poster_path ? IMAGE_BASE + m.poster_path : null,
    url: `https://www.themoviedb.org/movie/${m.id}`,
    // Only movie details include the length; discover/search results don't.
    ...(m.runtime ? { runtime: m.runtime } : {}),
  };
}

// "How much time do you have?" -> TMDB run-time filters (minutes). The 60-minute floor
// keeps short films out of "short".
const LENGTHS = {
  short: { 'with_runtime.gte': 60, 'with_runtime.lte': 90 },
  medium: { 'with_runtime.gte': 60, 'with_runtime.lte': 120 },
  long: { 'with_runtime.gte': 120 },
};

// A–Z can't use TMDB's own title sort: it orders by *original* title (French films under
// their French names), puts symbols and numbers first, and stops after 500 pages (around
// "S"). So the server collects the well-known films once, sorts them by the title shown,
// and keeps the list for a day.
const AZ_MIN_VOTES = 1000; // about 5,000 films
const AZ_MAX_AGE = 24 * 60 * 60 * 1000;
const AZ_CONCURRENCY = 8;
const PAGE_SIZE = 20;

function createTmdbClient(apiKey, { fetchImpl = globalThis.fetch, azMaxPages = MAX_PAGE } = {}) {
  // v4 read-access tokens are long JWTs sent as a Bearer header; v3 keys go in the query string.
  const isBearer = apiKey.length > 40;

  async function request(path, params = {}) {
    const url = new URL(API + path);
    if (!isBearer) url.searchParams.set('api_key', apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers = { Accept: 'application/json' };
    if (isBearer) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`TMDB responded ${res.status}`);
    return res.json();
  }

  // Source for recommend(): popular movies rated MIN_RATING+ for one or more emotions,
  // plus one recent release. `genreSets` has one genre list per emotion (may be empty).
  // `required` genres (typed by the user) limit the search to those genres; emotions then rank the results.
  async function recommendSource(genreSets, {
    count, exclude = [], hide = [], random = Math.random, now = new Date(), required = [], emotions = [], mode = 'lift',
    length,
  }) {
    const runtime = LENGTHS[length] || {};
    const toIds = (genres) => [...new Set(genres.map((g) => GENRE_IDS[g]).filter(Boolean))];
    // TMDB has no Sport or Biography genre: an empty result lets the built-in list handle those.
    const ids = required.length ? toIds(required) : toIds(genreSets.flat());
    if (!ids.length) return [];
    const any = ids.join('|'); // "|" = any of these genres
    const all = ids.join(','); // "," = all of these genres
    const today = now.toISOString().slice(0, 10);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const recentDates = { 'primary_release_date.gte': yearAgo, 'primary_release_date.lte': today };

    // Mood keywords (e.g. "hopeful", "feel-good" for sad): films with "avoid" keywords
    // (e.g. "depressing") are left out of every search, as long as that leaves something.
    const { avoid } = moodKeywords(emotions, mode);
    const withoutAvoided = avoid.length ? { without_keywords: avoid.join(',') } : {};

    // A random page keeps picks fresh; narrow searches may have fewer pages, so retry page 1,
    // and finally without the avoided keywords.
    const discover = async (withGenres, params, maxPage, { useAvoid = true } = {}) => {
      const page = 1 + Math.floor(random() * maxPage);
      const data = await request('/discover/movie', {
        with_genres: withGenres, sort_by: 'popularity.desc', 'vote_average.gte': MIN_RATING, include_adult: false,
        ...runtime, ...(useAvoid ? withoutAvoided : {}), ...params, page,
      });
      const results = data.results || [];
      if (!results.length && page > 1) return discover(withGenres, params, 1, { useAvoid });
      if (!results.length && useAvoid && avoid.length) return discover(withGenres, params, 1, { useAvoid: false });
      return results;
    };
    // Several typed genres (e.g. "romcom"): look for movies with all of them first, then any.
    const search = async (params, maxPage) => {
      if (required.length < 2) return discover(any, params, maxPage);
      const strict = await discover(all, params, Math.min(maxPage, 3));
      if (strict.length >= 8) return strict;
      const loose = await discover(any, params, 1);
      return [...strict, ...loose.filter((m) => !strict.some((x) => x.id === m.id))];
    };

    // With emotions and a typed genre, also fetch movies that are in the genre AND the mood's main
    // genre (e.g. Horror + Comedy for "happy" and "scary"), so mood-fitting picks are in the mix.
    const moodId = required.length
      ? toIds(genreSets.flat()).find((id) => !ids.includes(id))
      : undefined;
    const blend = moodId
      ? discover(`${all},${moodId}`, { 'vote_count.gte': 150 }, 2).catch(() => [])
      : Promise.resolve([]);

    // One mood-keyword search per emotion, so each film knows which emotion it fits.
    // Recent releases get their own, for the newest pick.
    // Keywords refine genres rather than replace them: a "sad" pick must be in sad's genres
    // (comedy, animation, family) AND hopeful/feel-good/...; a typed genre takes their place.
    const typedGenres = required.length ? (required.length > 1 ? all : any) : undefined;
    const moodSearch = (params, maxPage) => Promise.all(emotions.map((key, i) => {
      const { look } = moodKeywords([key], mode);
      const genresForMood = typedGenres || toIds(genreSets[i] || []).join('|');
      if (!look.length || !genresForMood) return [];
      return discover(genresForMood, { with_keywords: look.join('|'), ...params }, maxPage)
        .then((results) => results.map((r) => ({ ...r, moodIndex: i })))
        .catch(() => []);
    })).then((lists) => lists.flat());

    const [found, recent, blended, moodFound, moodRecent] = await Promise.all([
      search({ 'vote_count.gte': 300 }, 10),
      // New releases have fewer votes, so the floor is lower; it still keeps out barely-rated titles.
      search({ 'vote_count.gte': 100, ...recentDates }, 1).catch(() => []),
      blend,
      moodSearch({ 'vote_count.gte': 300 }, 8), // every emotion has 9+ pages of these
      moodSearch({ 'vote_count.gte': 100, ...recentDates }, 1),
    ]);

    // Merge the searches; a film found by several mood searches fits all those emotions.
    const combine = (...lists) => {
      const byId = new Map();
      for (const r of lists.flat()) {
        const prev = byId.get(r.id) || { ...toMovie(r), moodFits: [] };
        if (r.moodIndex !== undefined && !prev.moodFits.includes(r.moodIndex)) prev.moodFits.push(r.moodIndex);
        byId.set(r.id, prev);
      }
      return [...byId.values()];
    };
    const picks = pickMovies(combine(moodFound, blended, found), genreSets, {
      count, exclude, hide, random, required, newestPool: combine(moodRecent, recent),
    });
    return withRuntimes(picks);
  }

  // Adds each pick's length (one small details request per movie; skipped if it fails).
  async function withRuntimes(movies) {
    return Promise.all(movies.map(async (m) => {
      try {
        const details = await request(`/movie/${Number(m.id)}`);
        return details.runtime ? { ...m, runtime: details.runtime } : m;
      } catch {
        return m;
      }
    }));
  }

  // Browse/search the whole catalogue, 20 movies per page.
  let azList = null; // { builtAt, promise }

  async function buildAzList() {
    const params = {
      sort_by: 'popularity.desc', 'vote_count.gte': AZ_MIN_VOTES, include_adult: false,
      'primary_release_date.lte': new Date().toISOString().slice(0, 10),
    };
    const first = await request('/discover/movie', { ...params, page: 1 });
    const pages = Math.min(first.total_pages || 1, azMaxPages);
    const results = [...(first.results || [])];
    for (let start = 2; start <= pages; start += AZ_CONCURRENCY) {
      const batch = [];
      for (let p = start; p < start + AZ_CONCURRENCY && p <= pages; p++) {
        batch.push(request('/discover/movie', { ...params, page: p }).then((d) => d.results || []).catch(() => []));
      }
      (await Promise.all(batch)).forEach((list) => results.push(...list));
    }
    const byId = new Map(results.map((r) => [r.id, toMovie(r)]));
    return [...byId.values()].sort((a, b) => compareTitles(a.title, b.title));
  }

  // Shared by everyone; rebuilt after a day, or on the next request if building failed.
  function getAzList() {
    if (!azList || Date.now() - azList.builtAt > AZ_MAX_AGE) {
      const entry = { builtAt: Date.now() };
      entry.promise = buildAzList().catch((err) => {
        if (azList === entry) azList = null;
        throw err;
      });
      azList = entry;
    }
    return azList.promise;
  }

  async function browse({ q = '', genre = '', sort = 'popularity', page = 1 } = {}) {
    page = Math.min(Math.max(parseInt(page, 10) || 1, 1), MAX_PAGE);
    const genreId = GENRE_IDS[genre];
    let data;
    let movies;
    if (!q.trim() && sort === 'title') {
      const list = (await getAzList()).filter((m) => !genre || m.genres.includes(genre));
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      return {
        total: list.length,
        page,
        totalPages,
        movies: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      };
    }
    if (q.trim()) {
      // Search doesn't support genre filters, so filter the page's results ourselves.
      data = await request('/search/movie', { query: q.trim(), page, include_adult: false });
      movies = (data.results || []).filter((m) => !genreId || (m.genre_ids || []).includes(genreId));
    } else {
      data = await request('/discover/movie', {
        ...(BROWSE_SORTS[sort] || BROWSE_SORTS.popularity),
        with_genres: genreId,
        'primary_release_date.lte': new Date().toISOString().slice(0, 10),
        include_adult: false,
        page,
      });
      movies = data.results || [];
    }
    return {
      total: data.total_results || 0,
      page,
      totalPages: Math.min(data.total_pages || 1, MAX_PAGE),
      movies: movies.map(toMovie),
    };
  }

  async function getMovie(id) {
    return toMovie(await request(`/movie/${Number(id)}`));
  }

  // Best YouTube trailer for a TMDB movie id, or for a title/year (used by built-in movies).
  async function getTrailer({ id, title, year }) {
    let movieId = Number(id) || null;
    if (!movieId && title) {
      const found = await request('/search/movie', { query: title, year, include_adult: false });
      movieId = found.results && found.results[0] ? found.results[0].id : null;
    }
    if (!movieId) return null;
    const { results = [] } = await request(`/movie/${movieId}/videos`, { language: 'en-US' });
    const youtube = results.filter((v) => v.site === 'YouTube' && v.key);
    const score = (v) => (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) + (v.official ? 1 : 0);
    const best = youtube.sort((a, b) => score(b) - score(a))[0];
    return best ? { youtubeKey: best.key, name: best.name } : null;
  }

  return { recommendSource, browse, getMovie, getTrailer, genres: GENRES };
}

module.exports = { createTmdbClient, GENRE_IDS, toMovie, LENGTHS };
