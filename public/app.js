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
      ${m.isNewest ? '<span class="new-badge">🆕 Newest</span>' : ''}
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

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((ok) => setTimeout(ok, reduceMotion ? 0 : ms));

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
  updateFindButton();
}

// "Find movies" only appears once there's something to search for.
function updateFindButton() {
  $('#find').hidden = !state.selected.length && !$('#feeling-text').value.trim();
  $('#find').disabled = false;
}

// The blurred poster backdrop shows only while movies are being revealed.
function updateBackdrop() {
  $('#backdrop').hidden = $('#view-mood').hidden || $('#step-reveal').hidden;
}

function showStep(step) {
  $('#step-pick').hidden = step !== 'pick';
  $('#step-reveal').hidden = step !== 'reveal';
  updateBackdrop();
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

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
  setStatus('');
  renderChips();
});

$('#feeling-text').addEventListener('input', updateFindButton);
$('#feeling-text').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !$('#find').hidden && !$('#find').disabled) find();
});
$('#find').addEventListener('click', () => find());

function find() {
  state.text = $('#feeling-text').value.trim();
  if (!state.text && !state.selected.length) return;
  renderChips();
  getRecommendations({ fresh: true });
}

// Each search gets a number; results from an older search are ignored, so a
// change made while results were loading isn't overwritten by them.
let latestRequest = 0;

// Resolves when the image has loaded (or failed, or taken too long), so cards flip to a ready poster.
function preload(url, timeout = 2500) {
  if (!url) return Promise.resolve();
  return new Promise((done) => {
    const img = new Image();
    img.onload = img.onerror = done;
    img.src = url;
    setTimeout(done, timeout);
  });
}

async function getRecommendations({ fresh }) {
  const requestId = ++latestRequest;
  if (fresh) state.seen = [];
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const body = { mode, exclude: state.seen, emotions: state.selected };
  if (state.text) body.text = state.text;

  setStatus('');
  $('#find').disabled = true;
  $('#shuffle').disabled = true;
  showStep('reveal');
  // Until the results arrive, show the moods as picked (typed text is analysed by the server).
  $('#reveal-title').textContent = state.selected
    .map((k) => $(`.chip[data-emotion="${k}"]`)?.textContent.trim()).filter(Boolean).join(' + ') || 'Reading your mood…';
  $('#reveal-message').textContent = '';
  $('#stage').innerHTML = '';
  $('#stage').hidden = true;
  $('#reveal-nav').hidden = true;
  $('#swipe-hint').hidden = true;
  $('#summary').hidden = true;
  $('#loading').hidden = false;
  try {
    const [data] = await Promise.all([
      api('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      wait(1400), // let the shuffle animation play
    ]);
    if (requestId !== latestRequest) return;
    await Promise.all(data.movies.map((m) => preload(m.poster)));
    if (requestId !== latestRequest) return;

    state.seen.push(...data.movies.map((m) => m.id));
    // Moods found in typed text become selected chips, so "show me 3 others" needn't re-analyse it.
    if (body.text) {
      state.selected = data.emotions.map((e) => e.key);
      state.text = '';
      renderChips();
    }

    const via = data.detectedFrom === 'text' && data.matchedWords?.length
      ? ` (from “${data.matchedWords.join('”, “')}”)` : '';
    $('#reveal-title').textContent = `${data.emotions.map((e) => `${e.emoji} ${e.label}`).join(' + ')}${via}`;
    const reason = data.detectedFrom === 'ai' && data.reason ? `✨ ${data.reason} ` : '';
    $('#reveal-message').textContent = `${reason}${data.message}`;
    $('#loading').hidden = true;
    startReveal(data.movies);
  } catch (err) {
    if (requestId !== latestRequest) return;
    $('#loading').hidden = true;
    showStep('pick');
    setStatus(err.message, true);
  } finally {
    if (requestId === latestRequest) {
      $('#shuffle').disabled = false;
      updateFindButton();
    }
  }
}

/* ---------- One-by-one reveal ---------- */

const reveal = { movies: [], index: -1, flipped: new Set(), busy: false };

function revealCard(m, i, total) {
  rendered.set(movieKey(m), m);
  const key = escapeHtml(movieKey(m));
  const fav = isFavourite(m);
  const [emoji, c1, c2] = GENRE_STYLE[m.genres[0]] || ['🎬', '#555', '#999'];
  const poster = m.poster
    ? `<div class="reveal-poster" style="background-image:url('${encodeURI(m.poster)}')" role="img" aria-label="${escapeHtml(m.title)} poster"></div>`
    : `<div class="reveal-poster placeholder" style="background:linear-gradient(135deg, ${c1}, ${c2})"><span>${emoji}</span></div>`;
  const meta = [m.year, m.director].filter(Boolean).map(escapeHtml);
  return `
    <article class="reveal-card${m.isNewest ? ' is-newest' : ''}" aria-label="Movie ${i + 1} of ${total}: ${escapeHtml(m.title)}">
      <div class="flip">
        <div class="face back" aria-hidden="true">
          <span class="back-reel">🎞️</span>
          <span class="back-label">Pick ${i + 1} of ${total}</span>
          <span class="back-tap">Tap to reveal</span>
        </div>
        <div class="face front">
          <div class="poster-wrap">
            ${poster}
            ${m.isNewest ? '<span class="new-badge">🆕 Newest</span>' : ''}
          </div>
          <div class="reveal-info">
            <p class="reveal-count">Pick ${i + 1} of ${total}</p>
            <h3 class="reveal-name">${m.url
              ? `<a href="${encodeURI(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.title)}</a>`
              : escapeHtml(m.title)}</h3>
            <div class="meta">${meta.map((x) => `<span>${x}</span>`).join('')}</div>
            ${m.rating ? `<div class="rating" style="--pct:${Math.min(m.rating * 10, 100)}%"><span class="rating-bar"></span><strong>⭐ ${escapeHtml(m.rating)}</strong></div>` : ''}
            ${m.description ? `<p class="desc">${escapeHtml(m.description)}</p>` : ''}
            <div class="tags">${m.genres.map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join('')}</div>
            <div class="actions">
              <button class="trailer-btn" type="button" data-key="${key}">▶ Watch trailer</button>
              <button class="fav-btn${fav ? ' on' : ''}" type="button" data-key="${key}"
                      aria-pressed="${fav}" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}">${fav ? '♥' : '♡'}</button>
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

function setBackdrop(url) {
  const layers = document.querySelectorAll('.backdrop-layer');
  const next = [...layers].find((l) => !l.classList.contains('on')) || layers[0];
  layers.forEach((l) => l.classList.remove('on'));
  if (!url) return;
  next.style.backgroundImage = `url('${encodeURI(url)}')`;
  next.classList.add('on');
}

function sparkle(card) {
  if (reduceMotion) return;
  const burst = document.createElement('div');
  burst.className = 'sparkles';
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span');
    const angle = (i / 18) * Math.PI * 2;
    const dist = 90 + Math.random() * 90;
    s.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--y', `${Math.sin(angle) * dist}px`);
    s.style.animationDelay = `${Math.random() * 120}ms`;
    s.textContent = ['✦', '✧', '★', '·'][i % 4];
    burst.appendChild(s);
  }
  card.appendChild(burst);
  setTimeout(() => burst.remove(), 1400);
}

function flip(card, i) {
  if (!card || card.classList.contains('flipped')) return;
  card.classList.add('flipped');
  reveal.flipped.add(i);
  if (reveal.movies[i].isNewest) setTimeout(() => sparkle(card), reduceMotion ? 0 : 450);
}

function renderNav() {
  const { index, movies } = reveal;
  $('#dots').innerHTML = movies.map((_, i) =>
    `<span class="dot${i === index ? ' active' : ''}${reveal.flipped.has(i) ? ' seen' : ''}"></span>`).join('');
  $('#prev').disabled = index <= 0;
  $('#next').textContent = index >= movies.length - 1 ? 'See all 3 ✓' : 'Next →';
}

async function showCard(i, direction = 1) {
  if (reveal.busy || i < 0 || i >= reveal.movies.length) return;
  reveal.busy = true;
  const old = $('#stage .reveal-card');
  if (old) {
    old.classList.add(direction > 0 ? 'leave-left' : 'leave-right');
    await wait(320);
    old.remove();
  }
  reveal.index = i;
  const m = reveal.movies[i];
  $('#stage').innerHTML = revealCard(m, i, reveal.movies.length);
  const card = $('#stage .reveal-card');
  card.classList.add(direction > 0 ? 'enter-right' : 'enter-left');
  setBackdrop(m.poster);
  renderNav();
  if (reveal.flipped.has(i)) {
    card.classList.add('flipped', 'no-anim');
  } else {
    await wait(550);
    flip(card, i);
    renderNav();
  }
  reveal.busy = false;
}

function startReveal(movies) {
  reveal.movies = movies;
  reveal.index = -1;
  reveal.flipped = new Set();
  $('#summary').hidden = true;
  $('#stage').hidden = false;
  $('#reveal-nav').hidden = false;
  $('#swipe-hint').hidden = false;
  showCard(0);
}

function showSummary() {
  $('#stage').innerHTML = '';
  $('#stage').hidden = true;
  $('#reveal-nav').hidden = true;
  $('#swipe-hint').hidden = true;
  setBackdrop(null);
  $('#recommendations').innerHTML = reveal.movies.map(movieCard).join('');
  $('#summary').hidden = false;
}

function next() {
  if (reveal.busy) return;
  if (reveal.index >= reveal.movies.length - 1) showSummary();
  else showCard(reveal.index + 1, 1);
}
function prev() { showCard(reveal.index - 1, -1); }

$('#next').addEventListener('click', next);
$('#prev').addEventListener('click', prev);
$('#stage').addEventListener('click', (e) => {
  if (e.target.closest('button, a')) return;
  const card = e.target.closest('.reveal-card');
  if (card) flip(card, reveal.index);
});

// Swipe between cards on touch screens.
let swipeStart = null;
$('#stage').addEventListener('pointerdown', (e) => { swipeStart = { x: e.clientX, y: e.clientY }; });
$('#stage').addEventListener('pointerup', (e) => {
  if (!swipeStart) return;
  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
});

document.addEventListener('keydown', (e) => {
  if ($('#reveal-nav').hidden || $('#view-mood').hidden || $('#trailer-dialog').open) return;
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
});

function backToPick() {
  latestRequest++; // drop any search still loading
  setBackdrop(null);
  $('#loading').hidden = true;
  updateFindButton();
  showStep('pick');
}
$('#change-mood').addEventListener('click', backToPick);
$('#change-mood-2').addEventListener('click', backToPick);
$('#replay').addEventListener('click', () => startReveal(reveal.movies));
$('#shuffle').addEventListener('click', () => getRecommendations({ fresh: false }));

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
  } catch {
    // Couldn't look the trailer up: a YouTube search is the next best thing.
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${m.title} ${m.year || ''} trailer`)}`, '_blank', 'noopener');
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
  updateBackdrop();
  if (tab.dataset.view === 'favourites') renderFavourites();
  if (tab.dataset.view === 'browse' && !browseLoaded) {
    browseLoaded = true;
    Promise.all([loadConfig(), loadGenres()]).then(() => loadMovies());
  }
}));

updateFavCount();
loadEmotions().catch((err) => setStatus(err.message, true));
