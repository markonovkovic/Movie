'use strict';

// Integration with The Movie Database (https://www.themoviedb.org/).
// Enabled when TMDB_API_KEY is set; gives access to their full catalogue
// for both recommendations and the "All movies" list.
// Accepts either a v3 "API Key" or a v4 "API Read Access Token".

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
  title: { sort_by: 'title.asc', 'vote_count.gte': 200 },
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
  };
}

function createTmdbClient(apiKey, { fetchImpl = globalThis.fetch } = {}) {
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

  // Source for recommend(): random popular, well-rated movies from any of the genres.
  async function recommendSource(genres, { count, exclude = [], random = Math.random }) {
    const ids = genres.map((g) => GENRE_IDS[g]).filter(Boolean);
    if (!ids.length) return [];
    const data = await request('/discover/movie', {
      with_genres: ids.join('|'), // "|" = any of these genres
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.5,
      'vote_count.gte': 300,
      include_adult: false,
      page: 1 + Math.floor(random() * 10),
    });
    const excluded = new Set(exclude.map(Number));
    const results = (data.results || []).filter((m) => !excluded.has(m.id));
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return results.slice(0, count).map(toMovie);
  }

  // Browse/search the whole catalogue, 20 movies per page.
  async function browse({ q = '', genre = '', sort = 'popularity', page = 1 } = {}) {
    page = Math.min(Math.max(parseInt(page, 10) || 1, 1), MAX_PAGE);
    const genreId = GENRE_IDS[genre];
    let data;
    let movies;
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

module.exports = { createTmdbClient, GENRE_IDS, toMovie };
