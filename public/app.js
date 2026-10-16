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

const state = {
  emotion: null,  // selected emotion key
  text: '',       // free-text description
  seen: [],       // ids already recommended this session, for "show me 3 others"
};

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
  const [emoji, c1, c2] = GENRE_STYLE[m.genres[0]] || ['🎬', '#555', '#999'];
  const poster = m.poster
    ? `<div class="poster" style="background-image:url('${encodeURI(m.poster)}')" role="img" aria-label="${escapeHtml(m.title)} poster"></div>`
    : `<div class="poster" style="background:linear-gradient(135deg, ${c1}, ${c2})"><div><span class="poster-emoji">${emoji}</span>${escapeHtml(m.title)}</div></div>`;
  const meta = [m.year, m.rating ? `⭐ ${m.rating}` : null, m.director].filter(Boolean).map(escapeHtml);
  return `
    <article class="card">
      ${poster}
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(m.title)}</h3>
        <div class="meta">${meta.map((x) => `<span>${x}</span>`).join('')}</div>
        ${m.description ? `<p class="desc">${escapeHtml(m.description)}</p>` : ''}
        <div class="tags">${m.genres.map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join('')}</div>
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
    `<button class="chip" data-emotion="${e.key}" type="button"><span class="emoji">${e.emoji}</span>${escapeHtml(e.label)}</button>`).join('');
}

function highlightChip(key) {
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c.dataset.emotion === key));
}

async function getRecommendations({ fresh }) {
  if (fresh) state.seen = [];
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const body = { mode, exclude: state.seen };
  if (state.emotion) body.emotion = state.emotion; else body.text = state.text;

  setStatus('Finding movies for you…');
  $('#shuffle').disabled = true;
  try {
    const data = await api('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    state.seen.push(...data.movies.map((m) => m.id));
    highlightChip(data.emotion.key);

    const via = data.detectedFrom === 'text' && data.matchedWords?.length
      ? ` (from “${data.matchedWords.join('”, “')}”)` : '';
    $('#results-title').textContent = `${data.emotion.emoji} Feeling ${data.emotion.label.toLowerCase()}${via}`;
    $('#results-message').textContent = `${data.message} Genres: ${data.genres.join(', ')}.`;
    $('#recommendations').innerHTML = data.movies.map(movieCard).join('');
    $('#results').hidden = false;
    setStatus('');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    $('#shuffle').disabled = false;
  }
}

$('#emotion-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.emotion = chip.dataset.emotion;
  state.text = '';
  $('#feeling-text').value = '';
  getRecommendations({ fresh: true });
});

$('#text-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#feeling-text').value.trim();
  if (!text) return setStatus('Tell us how you feel first 🙂', true);
  state.emotion = null;
  state.text = text;
  getRecommendations({ fresh: true });
});

$('#shuffle').addEventListener('click', () => getRecommendations({ fresh: false }));

document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', () => { if (state.emotion || state.text) getRecommendations({ fresh: true }); }));

/* ---------- Browse view ---------- */

let browseTimer;
async function loadMovies() {
  const params = new URLSearchParams({ q: $('#search').value, genre: $('#genre').value, sort: $('#sort').value });
  try {
    const { total, movies } = await api(`/api/movies?${params}`);
    $('#count').textContent = `${total} movie${total === 1 ? '' : 's'}`;
    $('#movie-list').innerHTML = movies.map(movieCard).join('');
  } catch (err) {
    $('#count').textContent = err.message;
  }
}

async function loadGenres() {
  const { genres } = await api('/api/genres');
  $('#genre').insertAdjacentHTML('beforeend', genres.map((g) => `<option>${escapeHtml(g)}</option>`).join(''));
}

$('#search').addEventListener('input', () => { clearTimeout(browseTimer); browseTimer = setTimeout(loadMovies, 200); });
$('#genre').addEventListener('change', loadMovies);
$('#sort').addEventListener('change', loadMovies);

/* ---------- Tabs ---------- */

let browseLoaded = false;
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t === tab);
    t.setAttribute('aria-selected', String(t === tab));
  });
  $('#view-mood').hidden = tab.dataset.view !== 'mood';
  $('#view-browse').hidden = tab.dataset.view !== 'browse';
  if (tab.dataset.view === 'browse' && !browseLoaded) {
    browseLoaded = true;
    loadGenres().then(loadMovies);
  }
}));

loadEmotions().catch((err) => setStatus(err.message, true));
