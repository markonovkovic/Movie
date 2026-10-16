'use strict';

// Optional integration with The Movie Database (https://www.themoviedb.org/).
// Enabled when TMDB_API_KEY is set; gives access to their full catalogue.

const API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

const GENRE_IDS = {
  Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
  Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36,
  Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878,
  Thriller: 53, War: 10752, Western: 37,
};
const GENRE_NAMES = Object.fromEntries(Object.entries(GENRE_IDS).map(([name, id]) => [id, name]));

async function request(apiKey, path, params) {
  const url = new URL(API + path);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`TMDB responded ${res.status}`);
  return res.json();
}

function toMovie(m) {
  return {
    id: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    genres: (m.genre_ids || []).map((id) => GENRE_NAMES[id]).filter(Boolean),
    rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : null,
    description: m.overview,
    poster: m.poster_path ? IMAGE_BASE + m.poster_path : null,
  };
}

function createTmdbSource(apiKey) {
  // Returns a source function compatible with recommend()'s `deps.source`.
  return async function tmdbSource(genres, { count, exclude = [], random = Math.random }) {
    const ids = genres.map((g) => GENRE_IDS[g]).filter(Boolean);
    if (!ids.length) return [];
    const data = await request(apiKey, '/discover/movie', {
      with_genres: ids.join('|'), // "|" = any of these genres
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.5,
      'vote_count.gte': 300,
      include_adult: false,
      page: 1 + Math.floor(random() * 5),
    });
    const excluded = new Set(exclude.map(Number));
    const results = (data.results || []).filter((m) => !excluded.has(m.id));
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return results.slice(0, count).map(toMovie);
  };
}

module.exports = { createTmdbSource, GENRE_IDS };
