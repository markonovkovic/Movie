'use strict';

const $ = (sel) => document.querySelector(sel);

const GENRE_STYLE = {
  Action: ['💥', '#e53935', '#ff8a65'], Adventure: ['🗺️', '#00897b', '#80cbc4'],
  Animation: ['🎨', '#8e24aa', '#f48fb1'], Biography: ['📖', '#6d4c41', '#bcaaa4'],
  Comedy: ['😂', '#f9a825', '#ffe082'], Crime: ['🕵️', '#37474f', '#90a4ae'],
  Documentary: ['🎥', '#2e7d32', '#a5d6a7'], Drama: ['🎭', '#3949ab', '#9fa8da'],
  Family: ['👨‍👩‍👧', '#43a047', '#dce775'], Fantasy: ['🧙', '#5e35b1', '#b39ddb'],
  History: ['🏛️', '#795548', '#d7ccc8'], Horror: ['👻', '#212121', '#b71c1c'],
  Music: ['🎵', '#d81b60', '#ce93d8'], Mystery: ['🔍', '#283593', '#7986cb'],
  Romance: ['❤️', '#c2185b', '#f8bbd0'], 'Sci-Fi': ['🚀', '#0277bd', '#80deea'],
  Sport: ['🏆', '#ef6c00', '#ffcc80'], Thriller: ['🔪', '#4a148c', '#ef5350'],
  War: ['🎖️', '#455a64', '#a1887f'], Western: ['🤠', '#a1572b', '#ffcc80'],
};

const MAX_EMOTIONS = 3;
const state = {
  selected: [],   // selected emotion keys, in the order they were picked
  text: '',       // free-text description still to be analysed
  seen: [],       // ids already recommended for this mood, for "show me 3 others"
};

// Every movie rendered on the page, so card buttons can find their movie.
const rendered = new Map();
const movieKey = (m) => `${m.url ? 'tmdb' : 'local'}:${m.id}`;

/* ---------- Favourites (saved in this browser) ---------- */

const FAV_STORAGE = 'moviepicker:favourites';
function readFavourites() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_STORAGE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
let favourites = readFavourites();
function saveFavourites() {
  try { localStorage.setItem(FAV_STORAGE, JSON.stringify(favourites)); } catch { /* private mode etc. */ }
  updateFavCount();
}
const isFavourite = (m) => favourites.some((f) => movieKey(f) === movieKey(m));
function toggleFavourite(m) {
  favourites = isFavourite(m) ? favourites.filter((f) => movieKey(f) !== movieKey(m)) : [m, ...favourites];
  saveFavourites();
  document.querySelectorAll(`.fav-btn[data-key="${CSS.escape(movieKey(m))}"]`).forEach((b) => setFavButton(b, isFavourite(m)));
  if (!$('#view-favourites').hidden) renderFavourites();
}
function setFavButton(btn, on) {
  btn.classList.toggle('on', on);
  btn.textContent = on ? '♥' : '♡';
  btn.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
  btn.setAttribute('aria-pressed', String(on));
}
function updateFavCount() {
  $('#fav-count').textContent = favourites.length ? ` (${favourites.length})` : '';
}
function renderFavourites() {
  $('#favourites-list').innerHTML = favourites.map(movieCard).join('');
  $('#favourites-empty').hidden = favourites.length > 0;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function movieCard(m) {
  rendered.set(movieKey(m), m);
  const key = escapeHtml(movieKey(m));
  const fav = isFavourite(m);
  const [emoji, c1, c2] = GENRE_STYLE[m.genres[0]] || ['🎬', '#555', '#999'];
  const poster = m.poster
    ? `<div class="poster" style="background-image:url('${encodeURI(m.poster)}')" role="img" aria-label="${escapeHtml(m.title)} poster"></div>`
    : `<div class="poster" style="background:linear-gradient(135deg, ${c1}, ${c2})"><div><span class="poster-emoji">${emoji}</span>${escapeHtml(m.title)}</div></div>`;
  const meta = [m.year, m.rating ? `⭐ ${m.rating}` : null, m.director].filter(Boolean).map(escapeHtml);
  return `
    <article class="card">
      ${poster}
      <div class="card-body">
        <h3 class="card-title">${m.url
          ? `<a href="${encodeURI(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.title)}</a>`
          : escapeHtml(m.title)}</h3>
        <div class="meta">${meta.map((x) => `<span>${x}</span>`).join('')}</div>
        ${m.description ? `<p class="desc">${escapeHtml(m.description)}</p>` : ''}
        <div class="tags">${m.genres.map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join('')}</div>
        <div class="actions">
          <button class="trailer-btn" type="button" data-key="${key}">▶ Trailer</button>
          <button class="fav-btn${fav ? ' on' : ''}" type="button" data-key="${key}"
                  aria-pressed="${fav}" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}">${fav ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>`;
}

function setStatus(msg, isError = false) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

/* ---------- Mood view ---------- */

async function loadEmotions() {
  const { emotions } = await api('/api/emotions');
  $('#emotion-chips').innerHTML = emotions.map((e) =>
    `<button class="chip" data-emotion="${e.key}" type="button" aria-pressed="false"><span class="emoji">${e.emoji}</span>${escapeHtml(e.label)}</button>`).join('');
  renderChips();
}

function renderChips(warning = '') {
  document.querySelectorAll('.chip').forEach((c) => {
    const on = state.selected.includes(c.dataset.emotion);
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', String(on));
  });
  const n = state.selected.length;
  $('#chip-hint').classList.toggle('warn', Boolean(warning));
  $('#chip-hint').textContent = warning || (n
    ? `${n} of ${MAX_EMOTIONS} selected${n < MAX_EMOTIONS ? '. Tap another to mix moods.' : '.'}`
    : `Tap up to ${MAX_EMOTIONS} emotions to mix them.`);
}

async function getRecommendations({ fresh }) {
  if (fresh) state.seen = [];
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const body = { mode, exclude: state.seen, emotions: state.selected };
  if (state.text) body.text = state.text;

  setStatus('Finding movies for you…');
  $('#shuffle').disabled = true;
  try {
    const data = await api('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    state.seen.push(...data.movies.map((m) => m.id));
    // Moods found in the text become selected chips, so "show me 3 others" needn't re-analyse it.
    const keys = data.emotions.map((e) => e.key);
    if (keys.join() !== state.selected.join()) {
      state.selected = keys;
      renderChips();
    }
    state.text = '';

    const via = data.detectedFrom === 'text' && data.matchedWords?.length
      ? ` (from “${data.matchedWords.join('”, “')}”)` : '';
    const feelings = data.emotions.map((e) => `${e.emoji} ${e.label}`).join(' + ');
    $('#results-title').textContent = `${feelings}${via}`;
    const reason = data.detectedFrom === 'ai' && data.reason ? `✨ ${data.reason} ` : '';
    $('#results-message').textContent = `${reason}${data.message} Genres: ${data.genres.join(', ')}.`;
    $('#recommendations').innerHTML = data.movies.map(movieCard).join('');
    $('#results').hidden = false;
    setStatus('');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $('#shuffle').disabled = false;
  }
}

// Wait a moment after each tap so picking several emotions quickly makes one request.
let chipTimer;
$('#emotion-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const key = chip.dataset.emotion;
  if (state.selected.includes(key)) {
    state.selected = state.selected.filter((k) => k !== key);
  } else if (state.selected.length >= MAX_EMOTIONS) {
    return renderChips(`You can mix up to ${MAX_EMOTIONS} emotions. Tap a selected one to remove it first.`);
  } else {
    state.selected = [...state.selected, key];
  }
  state.text = '';
  renderChips();
  clearTimeout(chipTimer);
  if (!state.selected.length) {
    $('#results').hidden = true;
    return setStatus('');
  }
  setStatus('');
  chipTimer = setTimeout(() => getRecommendations({ fresh: true }), 350);
});

$('#text-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#feeling-text').value.trim();
  if (!text && !state.selected.length) return setStatus('Pick an emotion or tell us how you feel first 🙂', true);
  state.text = text;
  clearTimeout(chipTimer);
  renderChips();
  getRecommendations({ fresh: true });
});

$('#shuffle').addEventListener('click', () => getRecommendations({ fresh: false }));

document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => { if (state.selected.length || state.text) getRecommendations({ fresh: true }); }));

/* ---------- Browse view ---------- */

let browseTimer;
let browsePage = 1;
let browseRequest = 0; // ignore responses from outdated searches

async function loadMovies({ append = false } = {}) {
  const requestId = ++browseRequest;
  browsePage = append ? browsePage + 1 : 1;
  const params = new URLSearchParams({
    q: $('#search').value, genre: $('#genre').value, sort: $('#sort').value, page: browsePage,
  });
  $('#load-more').disabled = true;
  try {
    const data = await api(`/api/movies?${params}`);
    if (requestId !== browseRequest) return;
    const html = data.movies.map(movieCard).join('');
    if (append) $('#movie-list').insertAdjacentHTML('beforeend', html);
    else $('#movie-list').innerHTML = html;
    const total = data.total.toLocaleString();
    $('#count').textContent = data.notice || `${total} movie${data.total === 1 ? '' : 's'}`
      + (data.source === 'tmdb' ? ' on TMDB' : '');
    $('#load-more').hidden = data.page >= data.totalPages;
  } catch (err) {
    if (requestId === browseRequest) $('#count').textContent = err.message;
  } finally {
    $('#load-more').disabled = false;
  }
}

async function loadConfig() {
  const { source } = await api('/api/config');
  $('#source-badge').textContent = source === 'tmdb' ? 'TMDB · full catalogue' : 'Built-in list';
  if (source === 'tmdb') {
    $('#sort').insertAdjacentHTML('afterbegin', '<option value="popularity">Most popular</option>');
    $('#sort').value = 'popularity';
  }
}

async function loadGenres() {
  const { genres } = await api('/api/genres');
  $('#genre').insertAdjacentHTML('beforeend', genres.map((g) => `<option>${escapeHtml(g)}</option>`).join(''));
}

$('#search').addEventListener('input', () => { clearTimeout(browseTimer); browseTimer = setTimeout(() => loadMovies(), 250); });
$('#genre').addEventListener('change', () => loadMovies());
$('#sort').addEventListener('change', () => loadMovies());
$('#load-more').addEventListener('click', () => loadMovies({ append: true }));

/* ---------- Trailers ---------- */

const dialog = $('#trailer-dialog');
async function openTrailer(m, btn) {
  btn.disabled = true;
  const params = new URLSearchParams({ title: m.title, year: m.year || '' });
  if (m.url) params.set('id', m.id);
  try {
    const t = await api(`/api/trailer?${params}`);
    if (!t.youtubeKey) {
      window.open(t.searchUrl, '_blank', 'noopener');
      return;
    }
    $('#trailer-title').textContent = `${m.title}${m.year ? ` (${m.year})` : ''}`;
    $('#trailer-frame').src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.youtubeKey)}?autoplay=1&rel=0`;
    $('#trailer-youtube').href = t.searchUrl;
    dialog.showModal();
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    btn.disabled = false;
  }
}
function closeTrailer() {
  $('#trailer-frame').src = 'about:blank'; // stops playback
  if (dialog.open) dialog.close();
}
$('#trailer-close').addEventListener('click', closeTrailer);
dialog.addEventListener('close', closeTrailer);
dialog.addEventListener('click', (e) => { if (e.target === dialog) closeTrailer(); });

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.trailer-btn, .fav-btn');
  if (!btn) return;
  const m = rendered.get(btn.dataset.key);
  if (!m) return;
  if (btn.classList.contains('fav-btn')) toggleFavourite(m);
  else openTrailer(m, btn);
});

/* ---------- Tabs ---------- */

let browseLoaded = false;
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', String(t === tab));
  });
  $('#view-mood').hidden = tab.dataset.view !== 'mood';
  $('#view-browse').hidden = tab.dataset.view !== 'browse';
  $('#view-favourites').hidden = tab.dataset.view !== 'favourites';
  if (tab.dataset.view === 'favourites') renderFavourites();
  if (tab.dataset.view === 'browse' && !browseLoaded) {
    browseLoaded = true;
    Promise.all([loadConfig(), loadGenres()]).then(() => loadMovies());
  }
}));

updateFavCount();
loadEmotions().catch((err) => setStatus(err.message, true));
