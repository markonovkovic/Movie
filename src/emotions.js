'use strict';

// Each emotion has two genre lists:
//   match – lean into how you feel right now
//   lift  – change how you feel (default)
// `opposite` is used when a feeling is negated in free text ("not happy" -> sad).
const EMOTIONS = {
  happy: {
    label: 'Happy', emoji: '😄', opposite: 'sad',
    match: ['Comedy', 'Adventure', 'Music', 'Animation'],
    lift: ['Comedy', 'Adventure', 'Music', 'Animation'],
    message: 'Keep the good vibes going!',
    keywords: ['happy', 'glad', 'joy', 'joyful', 'great', 'good', 'awesome', 'cheerful', 'fantastic', 'wonderful', 'amazing', 'excited', 'thrilled', 'delighted', 'elated', 'pumped', 'yay'],
  },
  sad: {
    label: 'Sad', emoji: '😢', opposite: 'happy',
    match: ['Drama', 'Romance'],
    lift: ['Comedy', 'Animation', 'Family'],
    message: 'Something warm and funny to cheer you up.',
    keywords: ['sad', 'unhappy', 'down', 'depressed', 'blue', 'cry', 'crying', 'heartbroken', 'miserable', 'upset', 'gloomy', 'grief', 'grieving', 'hurt', 'low', 'bad', 'awful', 'terrible', 'breakup'],
  },
  stressed: {
    label: 'Stressed', emoji: '😰', opposite: 'relaxed',
    match: ['Thriller', 'Action'],
    lift: ['Animation', 'Comedy', 'Family', 'Documentary'],
    message: 'Easy, comforting watches to help you unwind.',
    keywords: ['stressed', 'stress', 'anxious', 'anxiety', 'nervous', 'worry', 'worried', 'worries', 'overwhelmed', 'tense', 'pressure', 'panic', 'busy', 'deadline', 'burnout', 'burned'],
  },
  relaxed: {
    label: 'Relaxed', emoji: '😌', opposite: 'stressed',
    match: ['Animation', 'Documentary', 'Romance', 'Family'],
    lift: ['Mystery', 'Sci-Fi', 'Drama'],
    message: 'You have the headspace for something absorbing.',
    keywords: ['relaxed', 'calm', 'chill', 'chilled', 'peaceful', 'content', 'cozy', 'cosy', 'mellow', 'lazy', 'zen'],
  },
  angry: {
    label: 'Angry', emoji: '😠', opposite: 'relaxed',
    match: ['Action', 'Crime', 'Thriller'],
    lift: ['Action', 'Comedy'],
    message: 'Blow off some steam with high-energy action.',
    keywords: ['angry', 'mad', 'furious', 'annoyed', 'irritated', 'frustrated', 'rage', 'pissed', 'livid', 'fed', 'hate'],
  },
  bored: {
    label: 'Bored', emoji: '🥱', opposite: 'curious',
    match: ['Adventure', 'Action'],
    lift: ['Adventure', 'Action', 'Thriller', 'Sci-Fi'],
    message: 'Something gripping to wake you up.',
    keywords: ['bored', 'boring', 'meh', 'nothing', 'restless', 'dull', 'uninspired', 'blah'],
  },
  lonely: {
    label: 'Lonely', emoji: '🥺', opposite: 'loved',
    match: ['Drama', 'Romance'],
    lift: ['Comedy', 'Family', 'Romance', 'Animation'],
    message: 'Heartwarming stories about friendship and connection.',
    keywords: ['lonely', 'alone', 'isolated', 'lonesome', 'abandoned', 'empty', 'friendless', 'single'],
  },
  loved: {
    label: 'Romantic', emoji: '🥰', opposite: 'lonely',
    match: ['Romance', 'Comedy'],
    lift: ['Romance', 'Comedy', 'Music'],
    message: 'Love is in the air, here are some romances.',
    keywords: ['romantic', 'love', 'loved', 'crush', 'date', 'dating', 'affectionate', 'flirty', 'valentine', 'smitten'],
  },
  scared: {
    label: 'Scared', emoji: '😱', opposite: 'adventurous',
    match: ['Horror', 'Thriller'],
    lift: ['Family', 'Animation', 'Comedy'],
    message: 'Something safe and gentle to settle your nerves.',
    keywords: ['scared', 'afraid', 'fear', 'frightened', 'terrified', 'spooked', 'creeped', 'spooky'],
  },
  adventurous: {
    label: 'Adventurous', emoji: '🤠', opposite: 'tired',
    match: ['Adventure', 'Action', 'Fantasy', 'Western'],
    lift: ['Adventure', 'Fantasy', 'Sci-Fi'],
    message: 'Epic journeys and big worlds to explore.',
    keywords: ['adventurous', 'adventure', 'brave', 'bold', 'daring', 'wild', 'explore', 'energetic', 'energized', 'thrill', 'adrenaline'],
  },
  tired: {
    label: 'Tired', emoji: '😴', opposite: 'adventurous',
    match: ['Animation', 'Comedy', 'Family'],
    lift: ['Animation', 'Comedy', 'Family'],
    message: 'Low-effort, feel-good picks for a sleepy brain.',
    keywords: ['tired', 'exhausted', 'sleepy', 'drained', 'worn', 'fatigued', 'wiped', 'knackered', 'beat'],
  },
  nostalgic: {
    label: 'Nostalgic', emoji: '📼', opposite: 'curious',
    match: ['Family', 'Adventure', 'Comedy', 'Animation'],
    lift: ['Family', 'Adventure', 'Comedy'],
    message: 'Timeless classics that feel like home.',
    keywords: ['nostalgic', 'nostalgia', 'childhood', 'memories', 'remember', 'reminiscing', 'old', 'retro', 'classic', 'sentimental'],
  },
  curious: {
    label: 'Curious', emoji: '🤔', opposite: 'bored',
    match: ['Mystery', 'Sci-Fi', 'Documentary'],
    lift: ['Mystery', 'Sci-Fi', 'Documentary', 'History'],
    message: 'Mind-bending stories to keep you thinking.',
    keywords: ['curious', 'thoughtful', 'thinking', 'philosophical', 'intrigued', 'interested', 'inquisitive', 'pensive', 'reflective', 'smart', 'learn'],
  },
  unmotivated: {
    label: 'Unmotivated', emoji: '😶', opposite: 'adventurous',
    match: ['Drama'],
    lift: ['Sport', 'Biography', 'Drama'],
    message: 'Inspiring true stories to get you going again.',
    keywords: ['unmotivated', 'stuck', 'lost', 'hopeless', 'useless', 'failure', 'failing', 'defeated', 'insecure', 'doubt', 'lazy', 'demotivated', 'inspire', 'inspired', 'motivation'],
  },
};

const NEGATIONS = new Set(['not', 'no', 'never', "don't", 'dont', "isn't", "aren't", "wasn't", "n't", 'nor', 'hardly']);
const NEGATION_WINDOW = 3;

// Build a word -> emotion lookup. Words listed under several emotions are
// resolved by first occurrence (more specific emotions are listed first).
const KEYWORD_INDEX = new Map();
for (const [key, emotion] of Object.entries(EMOTIONS)) {
  for (const word of emotion.keywords) {
    if (!KEYWORD_INDEX.has(word)) KEYWORD_INDEX.set(word, key);
  }
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .match(/[a-z']+/g) || [];
}

// Lightweight stemming so "crying", "stressful", "worrying" still match.
function lookup(word) {
  if (KEYWORD_INDEX.has(word)) return KEYWORD_INDEX.get(word);
  for (const suffix of ['ful', 'ing', 'ed', 'ly', 's']) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (KEYWORD_INDEX.has(stem)) return KEYWORD_INDEX.get(stem);
    }
  }
  return null;
}

/**
 * Detects emotions in free text.
 * Returns { emotion, emotions, scores, matched }: `emotion` is the dominant one (or null),
 * `emotions` lists up to three, strongest first.
 */
function detectEmotion(text) {
  const tokens = tokenize(text);
  const scores = {};
  const matched = [];

  tokens.forEach((token, i) => {
    let emotion = lookup(token);
    if (!emotion) return;
    const window = tokens.slice(Math.max(0, i - NEGATION_WINDOW), i);
    const negated = window.some((w) => NEGATIONS.has(w) || w.endsWith("n't"));
    if (negated) emotion = EMOTIONS[emotion].opposite;
    scores[emotion] = (scores[emotion] || 0) + 1;
    matched.push({ word: token, emotion, negated });
  });

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const emotions = ranked.slice(0, 3).map(([key]) => key);
  return { emotion: emotions[0] || null, emotions, scores, matched };
}

function listEmotions() {
  return Object.entries(EMOTIONS).map(([key, e]) => ({
    key, label: e.label, emoji: e.emoji, message: e.message, match: e.match, lift: e.lift,
  }));
}

module.exports = { EMOTIONS, detectEmotion, listEmotions, tokenize };
