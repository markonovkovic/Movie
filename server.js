'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { MOVIES, GENRES } = require('./src/movies');
const { listEmotions, detectEmotion } = require('./src/emotions');
const { recommend, RecommendationError } = require('./src/recommender');
const { createTmdbClient } = require('./src/tmdb');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const MAX_BODY = 10 * 1024;

// Minimal .env loader so TMDB_API_KEY can live in a file instead of the shell.
function loadEnvFile(file = path.join(__dirname, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        reject(new RecommendationError('Request body too large.', 413));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new RecommendationError('Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function listMovies(query) {
  const q = (query.get('q') || '').trim().toLowerCase();
  const genre = query.get('genre');
  let movies = MOVIES;
  if (genre) movies = movies.filter((m) => m.genres.includes(genre));
  if (q) {
    movies = movies.filter((m) =>
      m.title.toLowerCase().includes(q) || m.director.toLowerCase().includes(q) || String(m.year) === q);
  }
  const sort = query.get('sort') || 'title';
  const sorters = {
    title: (a, b) => a.title.localeCompare(b.title),
    year: (a, b) => b.year - a.year,
    rating: (a, b) => b.rating - a.rating,
  };
  sorters.popularity = sorters.rating;
  movies = movies.slice().sort(sorters[sort] || sorters.title);
  return { total: movies.length, page: 1, totalPages: 1, source: 'local', movies };
}

async function browseMovies(query, tmdb) {
  if (!tmdb) return listMovies(query);
  try {
    const result = await tmdb.browse({
      q: query.get('q') || '',
      genre: query.get('genre') || '',
      sort: query.get('sort') || 'popularity',
      page: query.get('page') || 1,
    });
    return { ...result, source: 'tmdb' };
  } catch (err) {
    console.warn(`[movies] TMDB failed, using local catalogue: ${err.message}`);
    return { ...listMovies(query), notice: 'TMDB is unavailable right now, showing the built-in list.' };
  }
}

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

function createServer({ tmdb } = {}) {
  const source = tmdb ? tmdb.recommendSource : undefined;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname, searchParams } = url;

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
      }

      if (pathname === '/api/emotions' && req.method === 'GET') {
        return sendJson(res, 200, { emotions: listEmotions() });
      }
      if (pathname === '/api/config' && req.method === 'GET') {
        return sendJson(res, 200, { source: tmdb ? 'tmdb' : 'local' });
      }
      if (pathname === '/api/genres' && req.method === 'GET') {
        return sendJson(res, 200, { genres: tmdb ? tmdb.genres : GENRES });
      }
      if (pathname === '/api/movies' && req.method === 'GET') {
        return sendJson(res, 200, await browseMovies(searchParams, tmdb));
      }
      const movieMatch = pathname.match(/^\/api\/movies\/(\d+)$/);
      if (movieMatch && req.method === 'GET') {
        if (tmdb) {
          try {
            return sendJson(res, 200, await tmdb.getMovie(movieMatch[1]));
          } catch (err) {
            return sendJson(res, /404/.test(err.message) ? 404 : 502, { error: 'Movie not found on TMDB.' });
          }
        }
        const movie = MOVIES.find((m) => m.id === Number(movieMatch[1]));
        return movie ? sendJson(res, 200, movie) : sendJson(res, 404, { error: 'Movie not found.' });
      }
      if (pathname === '/api/detect' && req.method === 'POST') {
        const { text } = await readJson(req);
        return sendJson(res, 200, detectEmotion(text || ''));
      }
      if (pathname === '/api/recommend' && (req.method === 'POST' || req.method === 'GET')) {
        const input = req.method === 'POST'
          ? await readJson(req)
          : {
            emotion: searchParams.get('emotion') || undefined,
            text: searchParams.get('text') || undefined,
            mode: searchParams.get('mode') || undefined,
            exclude: (searchParams.get('exclude') || '').split(',').filter(Boolean),
          };
        return sendJson(res, 200, await recommend(input, { source }));
      }
      if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, { error: 'Not found.' });
      }
      if (req.method === 'GET') return serveStatic(req, res, pathname);
      res.writeHead(405);
      return res.end();
    } catch (err) {
      if (err instanceof RecommendationError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      return sendJson(res, 500, { error: 'Something went wrong.' });
    }
  });
}

if (require.main === module) {
  loadEnvFile();
  const port = Number(process.env.PORT) || 3000;
  const key = (process.env.TMDB_API_KEY || '').trim();
  const tmdb = key ? createTmdbClient(key) : undefined;
  createServer({ tmdb }).listen(port, () => {
    console.log(`MoodFlix running at http://localhost:${port}`);
    console.log(tmdb
      ? 'Connected to TMDB: browsing and recommending from the full movie catalogue.'
      : 'Using the built-in movie catalogue. Set TMDB_API_KEY (or put it in .env) for all movies.');
  });
}

module.exports = { createServer };
