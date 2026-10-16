'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createTmdbClient } = require('../src/tmdb');
const { createServer } = require('../server');

const SAMPLE = [
  { id: 550, title: 'Fight Club', release_date: '1999-10-15', genre_ids: [18, 53], vote_average: 8.433, overview: 'x', poster_path: '/a.jpg' },
  { id: 13, title: 'Forrest Gump', release_date: '1994-06-23', genre_ids: [35, 18, 10749], vote_average: 8.5, overview: 'y', poster_path: null },
  { id: 27205, title: 'Inception', release_date: '2010-07-15', genre_ids: [28, 878], vote_average: 8.4, overview: 'z', poster_path: '/b.jpg' },
  { id: 120, title: 'LOTR', release_date: '2001-12-18', genre_ids: [12, 14], vote_average: 8.4, overview: 'w', poster_path: '/c.jpg' },
];

// Records requests and answers like TMDB would.
function fakeFetch(calls, { status = 200 } = {}) {
  return async (url, options) => {
    calls.push({ url: new URL(url), options });
    const body = new URL(url).pathname.startsWith('/3/movie/')
      ? { ...SAMPLE[0], genres: [{ id: 18, name: 'Drama' }], genre_ids: undefined }
      : { page: 1, results: SAMPLE, total_results: 12345, total_pages: 900 };
    return { ok: status === 200, status, json: async () => body };
  };
}

test('browse uses discover with genre, sort and page', async () => {
  const calls = [];
  const tmdb = createTmdbClient('v3key', { fetchImpl: fakeFetch(calls) });
  const res = await tmdb.browse({ genre: 'Drama', sort: 'rating', page: 3 });
  const { url } = calls[0];
  assert.strictEqual(url.pathname, '/3/discover/movie');
  assert.strictEqual(url.searchParams.get('api_key'), 'v3key');
  assert.strictEqual(url.searchParams.get('with_genres'), '18');
  assert.strictEqual(url.searchParams.get('sort_by'), 'vote_average.desc');
  assert.strictEqual(url.searchParams.get('page'), '3');
  assert.strictEqual(res.total, 12345);
  assert.strictEqual(res.totalPages, 500, 'capped at TMDB max page');
  assert.deepStrictEqual(res.movies[0], {
    id: 550, title: 'Fight Club', year: 1999, genres: ['Drama', 'Thriller'], rating: 8.4,
    description: 'x', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', url: 'https://www.themoviedb.org/movie/550',
  });
});

test('browse with a query uses search and filters by genre locally', async () => {
  const calls = [];
  const tmdb = createTmdbClient('v3key', { fetchImpl: fakeFetch(calls) });
  const res = await tmdb.browse({ q: ' gump ', genre: 'Comedy' });
  assert.strictEqual(calls[0].url.pathname, '/3/search/movie');
  assert.strictEqual(calls[0].url.searchParams.get('query'), 'gump');
  assert.deepStrictEqual(res.movies.map((m) => m.title), ['Forrest Gump']);
});

test('v4 read access tokens are sent as a Bearer header', async () => {
  const calls = [];
  const token = `eyJ${'a'.repeat(100)}`;
  const tmdb = createTmdbClient(token, { fetchImpl: fakeFetch(calls) });
  await tmdb.browse();
  assert.strictEqual(calls[0].options.headers.Authorization, `Bearer ${token}`);
  assert.strictEqual(calls[0].url.searchParams.get('api_key'), null);
});

test('recommendSource returns count movies from the emotion genres, minus excluded', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const movies = await tmdb.recommendSource(['Comedy', 'Animation'], { count: 3, exclude: [550] });
  assert.strictEqual(calls[0].url.searchParams.get('with_genres'), '35|16');
  assert.strictEqual(movies.length, 3);
  assert.ok(movies.every((m) => m.id !== 550));
});

test('server uses TMDB for movies, genres and config, and falls back when it fails', async () => {
  const calls = [];
  let failing = false;
  const fetchImpl = async (...args) => (failing ? fakeFetch(calls, { status: 503 }) : fakeFetch(calls))(...args);
  const server = createServer({ tmdb: createTmdbClient('k', { fetchImpl }) });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const orig = console.warn;
  console.warn = () => {};
  try {
    assert.deepStrictEqual(await (await fetch(`${base}/api/config`)).json(), { source: 'tmdb' });
    const list = await (await fetch(`${base}/api/movies?page=2`)).json();
    assert.strictEqual(list.source, 'tmdb');
    assert.strictEqual(list.total, 12345);
    const genres = (await (await fetch(`${base}/api/genres`)).json()).genres;
    assert.ok(genres.includes('Sci-Fi') && !genres.includes('Biography'));
    const rec = await (await fetch(`${base}/api/recommend?emotion=happy`)).json();
    assert.strictEqual(rec.source, 'tmdb');
    const one = await (await fetch(`${base}/api/movies/550`)).json();
    assert.deepStrictEqual(one.genres, ['Drama']);

    failing = true;
    const fallback = await (await fetch(`${base}/api/movies`)).json();
    assert.strictEqual(fallback.source, 'local');
    assert.match(fallback.notice, /unavailable/);
    const recFallback = await (await fetch(`${base}/api/recommend?emotion=happy`)).json();
    assert.strictEqual(recFallback.source, 'local');
    assert.strictEqual(recFallback.movies.length, 3);
  } finally {
    console.warn = orig;
    server.close();
  }
});
