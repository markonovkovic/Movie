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
    const { pathname } = new URL(url);
    const body = pathname.endsWith('/videos')
      ? { results: [
        { site: 'YouTube', key: 'teaser1', type: 'Teaser', official: true, name: 'Teaser' },
        { site: 'Vimeo', key: 'v', type: 'Trailer', official: true, name: 'Vimeo' },
        { site: 'YouTube', key: 'trailer1', type: 'Trailer', official: true, name: 'Official Trailer' },
        { site: 'YouTube', key: 'fan', type: 'Trailer', official: false, name: 'Fan trailer' },
      ] }
      : pathname.startsWith('/3/movie/')
        ? { ...SAMPLE[0], genres: [{ id: 18, name: 'Drama' }], genre_ids: undefined, runtime: 139 }
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
    description: 'x', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', backdrop: null, url: 'https://www.themoviedb.org/movie/550',
  });
});

test('A–Z is built once from well-known films, sorted by shown title, and paged locally', async () => {
  const titles = ['Zootopia', '12 Angry Men', 'Amélie', '#Alive', 'Up', 'Brave'];
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const page = Number(u.searchParams.get('page'));
    // 3 pages of 2 films each; Brave appears twice (popularity can shift while collecting).
    const results = titles.slice((page - 1) * 2, page * 2).map((t, i) => ({ id: t === 'Brave' ? 99 : page * 10 + i, title: t, genre_ids: t === 'Up' ? [16] : [35], vote_average: 7 }));
    if (page === 3) results.push({ id: 99, title: 'Brave', genre_ids: [35], vote_average: 7 });
    return { ok: true, status: 200, json: async () => ({ results, total_pages: 900, total_results: 18000 }) };
  };
  const tmdb = createTmdbClient('k', { fetchImpl, azMaxPages: 3 });
  const res = await tmdb.browse({ sort: 'title' });
  assert.deepStrictEqual(res.movies.map((m) => m.title), ['#Alive', 'Amélie', 'Brave', 'Up', 'Zootopia', '12 Angry Men']);
  assert.strictEqual(res.total, 6);
  assert.strictEqual(calls.length, 3, 'collected pages 1-3');
  assert.ok(calls.every((u) => u.searchParams.get('vote_count.gte') === '1000' && u.searchParams.get('sort_by') === 'popularity.desc'));

  const animation = await tmdb.browse({ sort: 'title', genre: 'Animation' });
  assert.deepStrictEqual(animation.movies.map((m) => m.title), ['Up']);
  assert.strictEqual(calls.length, 3, 'the list is reused, not rebuilt');
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

test('getTrailer picks the official YouTube trailer, by id or by title search', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  assert.deepStrictEqual(await tmdb.getTrailer({ id: 550 }), { youtubeKey: 'trailer1', name: 'Official Trailer' });
  assert.strictEqual(calls[0].url.pathname, '/3/movie/550/videos');

  calls.length = 0;
  await tmdb.getTrailer({ title: 'Fight Club', year: 1999 });
  assert.strictEqual(calls[0].url.pathname, '/3/search/movie');
  assert.strictEqual(calls[0].url.searchParams.get('year'), '1999');
  assert.strictEqual(calls[1].url.pathname, `/3/movie/${SAMPLE[0].id}/videos`);
});

test('recommendSource searches mood keywords per emotion, within its genres, and avoids heavy themes', async () => {
  const { moodKeywords } = require('../src/moods');
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const movies = await tmdb.recommendSource([['Comedy', 'Animation', 'Family']], { count: 3, emotions: ['sad'] });
  const moodCalls = calls.filter((c) => c.url.searchParams.get('with_keywords'));
  assert.strictEqual(moodCalls.length, 2, 'one mood search for picks, one for recent releases');
  assert.strictEqual(moodCalls[0].url.searchParams.get('with_keywords'), moodKeywords(['sad']).look.join('|'));
  assert.strictEqual(moodCalls[0].url.searchParams.get('with_genres'), '35|16|10751', 'keywords refine the genres');
  const searches = calls.filter((c) => c.url.pathname === '/3/discover/movie');
  assert.ok(searches.every((c) => c.url.searchParams.get('without_keywords') === moodKeywords(['sad']).avoid.join(',')));
  assert.ok(movies.some((m) => m.moodMatch));

  calls.length = 0;
  await tmdb.recommendSource([['Comedy']], { count: 3, emotions: ['sad'], mode: 'match' });
  assert.ok(calls.every((c) => !c.url.searchParams.get('with_keywords') && !c.url.searchParams.get('without_keywords')), 'match mode: genres only');
});

test('length filters every search by run-time, and picks get their run-time', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const movies = await tmdb.recommendSource([['Comedy']], { count: 2, emotions: ['happy'], length: 'short' });
  const searches = calls.filter((c) => c.url.pathname === '/3/discover/movie');
  assert.ok(searches.length > 0);
  assert.ok(searches.every((c) => c.url.searchParams.get('with_runtime.lte') === '90' && c.url.searchParams.get('with_runtime.gte') === '60'));
  const details = calls.filter((c) => /^\/3\/movie\/\d+$/.test(c.url.pathname));
  assert.ok(details.length >= movies.length && details.length <= movies.length * 3, 'one details lookup per candidate');
  assert.strictEqual(movies.length, 2, 'still 2 picks when none has a fitting real length');
  assert.ok(movies.every((m) => m.runtime === 139));

  calls.length = 0;
  await tmdb.recommendSource([['Comedy']], { count: 2, length: 'long' });
  assert.ok(calls.filter((c) => c.url.pathname === '/3/discover/movie')
    .every((c) => c.url.searchParams.get('with_runtime.gte') === '120' && !c.url.searchParams.get('with_runtime.lte')));
});

test('recommendSource with typed genres searches for all of them first, then any', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const movies = await tmdb.recommendSource([['Comedy', 'Family']], { count: 2, required: ['Romance', 'Comedy'] });
  const withGenres = calls.map((c) => c.url.searchParams.get('with_genres'));
  assert.ok(withGenres.includes('10749,35'), 'asks for movies with both genres');
  assert.ok(withGenres.includes('10749|35'), 'falls back to either genre when few have both');
  assert.ok(movies.every((m) => m.genres.includes('Romance') || m.genres.includes('Comedy')));
  assert.ok(withGenres.includes('10749,35,10751'), 'also looks for the typed genres plus the mood genre (Family)');

  calls.length = 0;
  assert.deepStrictEqual(await tmdb.recommendSource([], { count: 3, required: ['Sport'] }), [], 'TMDB has no Sport genre');
  assert.strictEqual(calls.length, 0);
});

test('recommendSource queries all emotion genres and only returns fitting movies', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const now = new Date('2026-10-16T12:00:00Z');
  const movies = await tmdb.recommendSource([['Comedy', 'Drama'], ['Sci-Fi']], { count: 2, exclude: [550], now });
  const [main, recent] = calls.map((c) => c.url.searchParams);
  assert.strictEqual(main.get('with_genres'), '35|18|878');
  assert.strictEqual(main.get('vote_average.gte'), '6');
  assert.strictEqual(recent.get('vote_average.gte'), '6');
  assert.strictEqual(recent.get('primary_release_date.gte'), '2025-10-16');
  assert.strictEqual(recent.get('primary_release_date.lte'), '2026-10-16');
  assert.strictEqual(movies.filter((m) => m.isNewest).length, 1);
  assert.deepStrictEqual(movies.map((m) => m.title).sort(), ['Forrest Gump', 'Inception']);

  // Only two unseen movies fit, so the third is topped up from ones already shown.
  const topped = await tmdb.recommendSource([['Comedy', 'Drama'], ['Sci-Fi']], { count: 3, exclude: [550] });
  assert.deepStrictEqual(topped.slice(0, 2).map((m) => m.title).sort(), ['Forrest Gump', 'Inception']);
  assert.strictEqual(topped[2].title, 'Fight Club');
  assert.strictEqual(topped.filter((m) => m.isNewest).length, 1);
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
    assert.deepStrictEqual(await (await fetch(`${base}/api/config`)).json(), { source: 'tmdb', aiMood: false });
    const list = await (await fetch(`${base}/api/movies?page=2`)).json();
    assert.strictEqual(list.source, 'tmdb');
    assert.strictEqual(list.total, 12345);
    const genres = (await (await fetch(`${base}/api/genres`)).json()).genres;
    assert.ok(genres.includes('Sci-Fi') && !genres.includes('Biography'));
    const rec = await (await fetch(`${base}/api/recommend?emotion=happy`)).json();
    assert.strictEqual(rec.source, 'tmdb');
    const trailer = await (await fetch(`${base}/api/trailer?id=550&title=Fight%20Club&year=1999`)).json();
    assert.strictEqual(trailer.youtubeKey, 'trailer1');
    assert.match(trailer.searchUrl, /search_query=Fight%20Club%201999%20trailer/);
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

test('recommendations only search films from 2015 on; recent searches keep their own window', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  await tmdb.recommendSource([['Comedy']], { count: 3, emotions: ['happy'], now: new Date('2026-10-20T00:00:00Z') });
  const searches = calls.filter((c) => c.url.pathname === '/3/discover/movie').map((c) => c.url.searchParams.get('primary_release_date.gte'));
  assert.ok(searches.includes('2015-01-01'));
  assert.ok(searches.includes('2025-10-20'), 'the newest pick still looks at the last year');
  assert.ok(searches.every((d) => d >= '2015-01-01'));
});

test('recommendSource with no genre and no emotion searches every genre', async () => {
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const movies = await tmdb.recommendSource([], { count: 3, length: 'short' });
  const searches = calls.filter((c) => c.url.pathname === '/3/discover/movie');
  assert.ok(searches.length > 0);
  assert.ok(searches.every((c) => !c.url.searchParams.has('with_genres') && c.url.searchParams.get('with_runtime.lte') === '90'));
  assert.strictEqual(movies.length, 3);
});

test('with a length, picks whose real run-time does not fit are dropped', async () => {
  // Films' real lengths (from their details): only Fight Club and LOTR are 2h+.
  const RUNTIMES = { 550: 139, 13: 110, 27205: 100, 120: 178 };
  const fetchImpl = async (url) => {
    const { pathname } = new URL(url);
    const id = Number(pathname.split('/').pop());
    const body = /^\/3\/movie\/\d+$/.test(pathname)
      ? { ...SAMPLE.find((m) => m.id === id), runtime: RUNTIMES[id] }
      : { page: 1, results: SAMPLE, total_results: 4, total_pages: 1 };
    return { ok: true, status: 200, json: async () => body };
  };
  const tmdb = createTmdbClient('k', { fetchImpl });
  for (let i = 0; i < 5; i++) {
    const movies = await tmdb.recommendSource([], { count: 2, length: 'long' });
    assert.deepStrictEqual(movies.map((m) => m.id).sort(), [120, 550]);
  }
});

test('a style (Superhero, Romcom, ...) searches by its keywords and/or genres', async () => {
  const { STYLES } = require('../src/genres');
  const calls = [];
  const tmdb = createTmdbClient('k', { fetchImpl: fakeFetch(calls) });
  const movies = await tmdb.recommendSource([], { count: 3, required: ['Superhero'] });
  const searches = calls.filter((c) => c.url.pathname === '/3/discover/movie');
  assert.ok(searches.every((c) => c.url.searchParams.get('with_keywords') === STYLES.Superhero.keywords.join('|')));
  assert.ok(searches.every((c) => !c.url.searchParams.has('with_genres')), 'any genre');
  assert.strictEqual(movies.length, 3);

  calls.length = 0;
  await tmdb.recommendSource([], { count: 3, required: ['Romcom'] });
  const romcom = calls.filter((c) => c.url.pathname === '/3/discover/movie');
  assert.ok(romcom.some((c) => c.url.searchParams.get('with_genres') === '10749,35'), 'romance AND comedy');
  assert.ok(romcom.every((c) => !c.url.searchParams.has('with_keywords')));
});
