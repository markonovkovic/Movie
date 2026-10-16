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

/* ---------- Theme: Auto (follows the device), Light or Dark ---------- */

const THEME_KEY = 'moviepicker:theme';
const THEMES = ['auto', 'light', 'dark'];
const THEME_ICONS = { auto: '🌗', light: '☀️', dark: '🌙' };
const THEME_COLORS = { light: '#f6f5fb', dark: '#0b0a12' };
const currentTheme = () => document.documentElement.dataset.theme || 'auto';

function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch { /* not saved, still applied */ }
  // Match the phone's status bar to the chosen theme (Auto keeps the light/dark pair).
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    if (!meta.dataset.auto) meta.dataset.auto = meta.content;
    meta.content = theme === 'auto' ? meta.dataset.auto : THEME_COLORS[theme];
  });
  const label = theme[0].toUpperCase() + theme.slice(1);
  const btn = $('#theme-toggle');
  btn.querySelector('.theme-icon').textContent = THEME_ICONS[theme];
  btn.querySelector('.theme-label').textContent = label;
  btn.setAttribute('aria-label', `Theme: ${label}. Tap to change.`);
  btn.title = `Theme: ${label}`;
}
$('#theme-toggle').addEventListener('click', () => {
  applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);
});
applyTheme(currentTheme());

/* ---------- Tap ripple on buttons ---------- */

const RIPPLE_TARGETS = 'button, .chip, .tab';
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest(RIPPLE_TARGETS);
  if (!el || el.disabled || reduceMotion || e.button > 0) return;
  if (!el.classList.contains('has-ripple')) {
    // Keep sticky/absolute buttons as they are; only plain ones need positioning for the ripple.
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.classList.add('has-ripple');
  }
  const rect = el.getBoundingClientRect();
  const size = Math.hypot(rect.width, rect.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  el.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

/* ---------- Install as an app (PWA) ---------- */

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Android / Chrome / Edge: offer our own Install button.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (!isStandalone()) $('#install-btn').hidden = false;
});
$('#install-btn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $('#install-btn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#install-btn').hidden = true; });

// iPhone / iPad have no install prompt, so show a one-time "Add to Home Screen" tip.
const IOS_TIP_KEY = 'moviepicker:ios-tip-dismissed';
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let iosTipDismissed = false;
try { iosTipDismissed = localStorage.getItem(IOS_TIP_KEY) === '1'; } catch { /* show it */ }
if (isIos && !isStandalone() && !iosTipDismissed) $('#ios-tip').hidden = false;
$('#ios-tip-close').addEventListener('click', () => {
  $('#ios-tip').hidden = true;
  try { localStorage.setItem(IOS_TIP_KEY, '1'); } catch { /* hidden for this visit */ }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

const MAX_EMOTIONS = 3;
const state = {
  selected: [],   // selected emotion keys, in the order they were picked
  genres: [],     // the selected genre (at most one); empty means any genre
  length: null,   // 'short' | 'medium' | 'long'; null means any length
  shown: [],      // ids already recommended for this mood, for "show me 3 others"
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
// Outline heart icon; CSS fills it in when the movie is a favourite.
const HEART_ICON = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
function favButton(m) {
  const on = isFavourite(m);
  return `<button class="fav-btn${on ? ' on' : ''}" type="button" data-key="${escapeHtml(movieKey(m))}"
            aria-pressed="${on}" aria-label="${on ? 'Remove from favourites' : 'Add to favourites'}">${HEART_ICON}</button>`;
}

const isFavourite = (m) => favourites.some((f) => movieKey(f) === movieKey(m));
function toggleFavourite(m) {
  // "Newest" describes a recommendation, not the movie, so it isn't saved.
  const { isNewest, moodMatch, ...saved } = m;
  favourites = isFavourite(m) ? favourites.filter((f) => movieKey(f) !== movieKey(m)) : [saved, ...favourites];
  saveFavourites();
  document.querySelectorAll(`.fav-btn[data-key="${CSS.escape(movieKey(m))}"]`).forEach((b) => setFavButton(b, isFavourite(m)));
  if (!$('#view-favourites').hidden) renderFavourites();
  toast(isFavourite(m) ? `Saved “${m.title}”. Favourites aren't suggested again.` : `Removed “${m.title}” from favourites.`);
}
function setFavButton(btn, on) {
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-label', on ? 'Remove from favourites' : 'Add to favourites');
  btn.setAttribute('aria-pressed', String(on));
  // Little "pop" when saved.
  btn.classList.remove('pop');
  if (on) {
    void btn.offsetWidth; // restart the animation
    btn.classList.add('pop');
  }
}
function updateFavCount() {
  const badge = $('#fav-count');
  badge.textContent = favourites.length;
  badge.hidden = !favourites.length;
  $('#fav-tab').setAttribute('aria-label', `Favourites${favourites.length ? ` (${favourites.length})` : ''}`);
}
/* ---------- Seen it (saved in this browser): never suggested again ---------- */

const SEEN_STORAGE = 'moviepicker:seen';
let seenList = (() => {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_STORAGE) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
})();
function saveSeen() {
  try { localStorage.setItem(SEEN_STORAGE, JSON.stringify(seenList)); } catch { /* private mode etc. */ }
}
const EYE_ICON = '<svg class="eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>';
const isSeen = (m) => seenList.some((f) => movieKey(f) === movieKey(m));
function seenButton(m) {
  const on = isSeen(m);
  return `<button class="seen-btn${on ? ' on' : ''}" type="button" data-key="${escapeHtml(movieKey(m))}"
            aria-pressed="${on}" aria-label="${on ? 'Seen it. Tap to undo' : 'Mark as seen'}" title="${on ? 'Seen it' : 'Seen it?'}">${EYE_ICON}</button>`;
}
function toggleSeen(m) {
  const { isNewest, moodMatch, ...saved } = m;
  const nowSeen = !isSeen(m);
  seenList = nowSeen ? [saved, ...seenList] : seenList.filter((f) => movieKey(f) !== movieKey(m));
  saveSeen();
  document.querySelectorAll(`.seen-btn[data-key="${CSS.escape(movieKey(m))}"]`).forEach((b) => {
    b.classList.toggle('on', nowSeen);
    b.setAttribute('aria-pressed', String(nowSeen));
    b.setAttribute('aria-label', nowSeen ? 'Seen it. Tap to undo' : 'Mark as seen');
    b.title = nowSeen ? 'Seen it' : 'Seen it?';
  });
  if (!$('#view-favourites').hidden) renderFavourites();
  toast(nowSeen ? `Marked “${m.title}” as seen. It won't be suggested again.` : `“${m.title}” can be suggested again.`);
}

// Seen and favourite movies are never suggested. IDs only mean something within one
// catalogue (TMDB or the built-in list), so only those from the active one are sent.
let catalogueSource = null;
const configReady = api('/api/config')
  .then((config) => { catalogueSource = config.source; return config; })
  .catch(() => ({ source: 'local' }));
function hiddenIds() {
  const prefix = `${catalogueSource || 'tmdb'}:`;
  return [...new Set([...favourites, ...seenList].map(movieKey))]
    .filter((key) => key.startsWith(prefix)).map((key) => Number(key.slice(prefix.length)));
}

/* ---------- Your lists: favourites and seen ---------- */

let activeList = 'favourites';
function renderFavourites() {
  $('#favourites-list').innerHTML = favourites.map(movieCard).join('');
  $('#favourites-empty').hidden = favourites.length > 0;
  $('#seen-list').innerHTML = seenList.map(movieCard).join('');
  $('#seen-empty').hidden = seenList.length > 0;
  $('#clear-seen').hidden = !seenList.length;
  $('#fav-list-count').textContent = favourites.length || '';
  $('#seen-list-count').textContent = seenList.length || '';
  document.querySelectorAll('.list-tab').forEach((t) => {
    const on = t.dataset.list === activeList;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  $('#list-favourites').hidden = activeList !== 'favourites';
  $('#list-seen').hidden = activeList !== 'seen';
}
document.querySelectorAll('.list-tab').forEach((t) => t.addEventListener('click', () => {
  activeList = t.dataset.list;
  renderFavourites();
}));
$('#clear-seen').addEventListener('click', () => {
  if (!confirm(`Clear your Seen list (${seenList.length} movie${seenList.length === 1 ? '' : 's'})? They can be suggested again.`)) return;
  seenList = [];
  saveSeen();
  document.querySelectorAll('.seen-btn.on').forEach((b) => b.classList.remove('on'));
  renderFavourites();
  toast('Seen list cleared.');
});

/* ---------- Toast: short confirmation messages ---------- */

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error(navigator.onLine === false
      ? "You're offline. Connect to the internet to find movies."
      : "Couldn't reach MoviePicker. Please try again in a moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function movieCard(m) {
  rendered.set(movieKey(m), m);
  const key = escapeHtml(movieKey(m));
  const [emoji, c1, c2] = GENRE_STYLE[m.genres[0]] || ['🎬', '#555', '#999'];
  const poster = m.poster
    ? `<div class="poster" style="background-image:url('${encodeURI(m.poster)}')" role="img" aria-label="${escapeHtml(m.title)} poster"></div>`
    : `<div class="poster" style="background:linear-gradient(135deg, ${c1}, ${c2})"><div><span class="poster-emoji">${emoji}</span>${escapeHtml(m.title)}</div></div>`;
  const meta = [m.year, m.rating ? `⭐ ${m.rating}` : null, formatRuntime(m.runtime), m.director].filter(Boolean).map(escapeHtml);
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
          ${seenButton(m)}
          ${favButton(m)}
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
  document.querySelectorAll('#emotion-chips .chip').forEach((c) => {
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
  $('#find').hidden = !state.selected.length && !state.genres.length;
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

/* Genre options: none selected by default, at most one at a time. */
async function loadGenreChips() {
  const { genres } = await api('/api/genres');
  $('#genre-chips').innerHTML = genres.map((g) =>
    `<button class="chip genre-opt" data-genre="${escapeHtml(g)}" type="button" aria-pressed="false"><span class="emoji">${(GENRE_STYLE[g] || ['🎬'])[0]}</span>${escapeHtml(g)}</button>`).join('');
  renderGenreChips();
}

function renderGenreChips() {
  document.querySelectorAll('.genre-opt').forEach((c) => {
    const on = state.genres.includes(c.dataset.genre);
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', String(on));
  });
  $('#genre-hint').textContent = state.genres.length
    ? `All picks will be ${state.genres[0]}. Tap it again to clear.`
    : 'Tap a genre to choose one.';
  updateFindButton();
}

// Tapping a genre selects it (replacing any other); tapping the selected one clears it.
$('#genre-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.genre-opt');
  if (!chip) return;
  const g = chip.dataset.genre;
  state.genres = state.genres.includes(g) ? [] : [g];
  setStatus('');
  renderGenreChips();
});

/* "How much time do you have?": none by default, at most one; doesn't start a search by itself. */
function renderLengthChips() {
  document.querySelectorAll('.length-opt').forEach((c) => {
    const on = c.dataset.length === state.length;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', String(on));
  });
}
$('#length-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.length-opt');
  if (!chip) return;
  state.length = state.length === chip.dataset.length ? null : chip.dataset.length;
  renderLengthChips();
});

// A chip's emoji and text as one label: "⚡ Under 90 min".
function chipLabel(chip) {
  return chip ? [...chip.childNodes].map((n) => n.textContent.trim()).filter(Boolean).join(' ') : '';
}

// 92 -> "1h 32m", 45 -> "45m"
function formatRuntime(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

$('#find').addEventListener('click', () => find());

function find() {
  if (!state.genres.length && !state.selected.length) return;
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
  if (fresh) state.shown = [];
  // The server's default "lift" mode is used: movies that help change the chosen mood.
  await configReady;
  const body = { exclude: state.shown, hide: hiddenIds(), emotions: state.selected };
  if (state.genres.length) body.genres = state.genres;
  if (state.length) body.length = state.length;

  setStatus('');
  $('#find').disabled = true;
  $('#shuffle').disabled = true;
  showStep('reveal');
  // Until the results arrive, show what was picked.
  $('#reveal-title').textContent = [
    state.selected.map((k) => chipLabel($(`.chip[data-emotion="${k}"]`))).filter(Boolean).join(' + '),
    state.genres.map((g) => `${(GENRE_STYLE[g] || ['🎬'])[0]} ${g}`).join(' + '),
    state.length ? chipLabel($(`.length-opt[data-length="${state.length}"]`)) : '',
  ].filter(Boolean).join('  ·  ') || 'Finding your movies…';
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

    state.shown.push(...data.movies.map((m) => m.id));

    const moods = data.emotions.map((e) => `${e.emoji} ${e.label}`).join(' + ');
    const genres = (data.requestedGenres || []).map((g) => `${(GENRE_STYLE[g] || ['🎬'])[0]} ${g}`).join(' + ');
    const length = data.length ? chipLabel($(`.length-opt[data-length="${data.length.key}"]`)) : '';
    $('#reveal-title').textContent = [moods, genres, length].filter(Boolean).join('  ·  ');
    $('#reveal-message').textContent = data.message;
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
  const [emoji, c1, c2] = GENRE_STYLE[m.genres[0]] || ['🎬', '#555', '#999'];
  const poster = m.poster
    ? `<div class="reveal-poster" style="background-image:url('${encodeURI(m.poster)}')" role="img" aria-label="${escapeHtml(m.title)} poster"></div>`
    : `<div class="reveal-poster placeholder" style="background:linear-gradient(135deg, ${c1}, ${c2})"><span>${emoji}</span></div>`;
  const meta = [m.year, formatRuntime(m.runtime), m.director].filter(Boolean).map(escapeHtml);
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
              ${seenButton(m)}
          ${favButton(m)}
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
  const last = index >= movies.length - 1;
  $('#next').textContent = last ? 'See all 3 ✓' : 'Next →';
  // On the last card, Start over takes the dots' place so it's reachable before the summary.
  $('#dots').hidden = last;
  $('#nav-start-over').hidden = !last;
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

// Back to the first screen with nothing selected, to choose a new mood and genre.
function startOver() {
  state.selected = [];
  state.genres = [];
  state.length = null;
  state.shown = [];
  setStatus('');
  renderChips();
  renderGenreChips();
  renderLengthChips();
  backToPick();
}
$('#start-over').addEventListener('click', startOver);
$('#nav-start-over').addEventListener('click', startOver);
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
  const { source } = await configReady;
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
  const btn = e.target.closest('.trailer-btn, .fav-btn, .seen-btn');
  if (!btn) return;
  const m = rendered.get(btn.dataset.key);
  if (!m) return;
  if (btn.classList.contains('fav-btn')) toggleFavourite(m);
  else if (btn.classList.contains('seen-btn')) toggleSeen(m);
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

// The logo goes home: the mood tab, first screen, nothing selected (no page reload needed).
$('#home-link').addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" work
  e.preventDefault();
  if ($('#trailer-dialog').open) closeTrailer();
  $('.tab[data-view="mood"]').click();
  startOver();
});

updateFavCount();
loadEmotions().catch((err) => setStatus(err.message, true));
loadGenreChips().catch(() => { $('#genre-chips').hidden = true; });
