'use strict';

// TMDB keywords that describe how a film *feels*, used with TMDB to pick movies that
// fit a mood better than genres alone. Many are TMDB's "tone" tags (hopeful, cheerful,
// gloomy, ...). For each emotion (in the default "lift" mode):
//   look  – films with ANY of these are preferred (within the emotion's genres)
//   avoid – films with ANY of these are left out
// IDs come from TMDB's /search/keyword; only tags used on many well-rated films are kept.
const K = {
  // tone
  hopeful: 325824, cheerful: 325782, joyful: 325832, playful: 259376, witty: 319397,
  hilarious: 320420, sentimental: 319319, romantic: 324429, thoughtful: 210434,
  intense: 321464, suspenseful: 314730, frightened: 325818, melancholy: 4232, gloomy: 325822,
  tense: 316832, awestruck: 325775, admiring: 325761, empathetic: 325806, sincere: 325849,
  exhilarated: 325812, provocative: 293649, mysterious: 197582, celebratory: 325781,
  bold: 325778, gentle: 325820, calm: 209673, compassionate: 325786, anxious: 251667,
  depressing: 323809, grim: 210162, lighthearted: 288816, comforting: 325784,
  whimsical: 324713, inspirational: 281585, nostalgic: 164246, wonder: 240422,
  // themes
  feelgood: 275276, heartwarming: 319357, friendship: 6054, foundFamily: 248927,
  unlikelyFriendship: 167982, underdog: 240, basedOnTrueStory: 9672, sports: 6075,
  timeTravel: 4379, comingOfAge: 10683, childhood: 157955, eighties: 208289,
  loveAtFirstSight: 699, philosophy: 490, puzzle: 9228, heist: 10051, survival: 10349,
  roadTrip: 7312, quest: 207372, adventure: 322942,
  // heavy themes to steer away from when lifting a mood
  tragedy: 10614, tearjerker: 156924, grief: 9872, suicide: 236, loneliness: 9957,
  divorce: 15160, psychologicalThriller: 12565, torture: 13006, holocaust: 1739, rape: 570,
  drugAddiction: 1803, abuse: 207691, warCrimes: 1327,
};

// Heavy themes kept out of every mood the app is trying to lift.
const HEAVY = ['depressing', 'gloomy', 'grim', 'tragedy', 'tearjerker', 'grief', 'suicide',
  'holocaust', 'torture', 'rape', 'drugAddiction', 'abuse', 'warCrimes'];

const MOOD_KEYWORDS = {
  happy: {
    look: ['cheerful', 'joyful', 'hilarious', 'playful', 'celebratory', 'lighthearted', 'feelgood', 'witty'],
    avoid: [...HEAVY, 'melancholy'],
  },
  sad: {
    look: ['hopeful', 'cheerful', 'heartwarming', 'feelgood', 'comforting', 'lighthearted', 'sincere', 'gentle'],
    avoid: [...HEAVY, 'melancholy'],
  },
  stressed: {
    look: ['lighthearted', 'comforting', 'gentle', 'calm', 'cheerful', 'playful', 'whimsical'],
    avoid: [...HEAVY, 'tense', 'anxious', 'intense', 'suspenseful', 'frightened', 'psychologicalThriller'],
  },
  relaxed: {
    look: ['thoughtful', 'mysterious', 'awestruck', 'philosophy', 'timeTravel', 'wonder'],
    avoid: [],
  },
  angry: {
    look: ['exhilarated', 'bold', 'hilarious', 'witty', 'heist'],
    avoid: [...HEAVY],
  },
  bored: {
    look: ['exhilarated', 'intense', 'suspenseful', 'heist', 'survival', 'bold'],
    avoid: ['calm', 'gentle'],
  },
  lonely: {
    look: ['friendship', 'foundFamily', 'unlikelyFriendship', 'empathetic', 'compassionate', 'heartwarming', 'hopeful'],
    avoid: [...HEAVY, 'loneliness'],
  },
  loved: {
    look: ['romantic', 'loveAtFirstSight', 'sentimental', 'hopeful'],
    avoid: [...HEAVY, 'divorce'],
  },
  scared: {
    look: ['gentle', 'comforting', 'lighthearted', 'cheerful', 'whimsical'],
    avoid: [...HEAVY, 'frightened', 'suspenseful', 'tense', 'anxious'],
  },
  adventurous: {
    look: ['awestruck', 'exhilarated', 'wonder', 'quest', 'adventure', 'roadTrip', 'survival'],
    avoid: [...HEAVY],
  },
  tired: {
    look: ['lighthearted', 'comforting', 'gentle', 'cheerful', 'hilarious', 'playful'],
    avoid: [...HEAVY, 'intense', 'tense', 'suspenseful'],
  },
  nostalgic: {
    look: ['nostalgic', 'eighties', 'childhood', 'comingOfAge', 'whimsical'],
    avoid: [...HEAVY],
  },
  curious: {
    look: ['thoughtful', 'mysterious', 'philosophy', 'timeTravel', 'provocative', 'awestruck', 'puzzle'],
    avoid: [],
  },
  unmotivated: {
    look: ['inspirational', 'underdog', 'hopeful', 'sports'],
    avoid: [...HEAVY],
  },
};

/**
 * Keyword IDs for the chosen emotions: { look, avoid }. Several emotions are combined;
 * a keyword one emotion looks for is never avoided because of another.
 * Only the default "lift" mode uses keywords; "match" keeps genre-only picks.
 */
function moodKeywords(emotionKeys = [], mode = 'lift') {
  if (mode !== 'lift') return { look: [], avoid: [] };
  const look = new Set();
  const avoid = new Set();
  for (const key of emotionKeys) {
    const mood = MOOD_KEYWORDS[key];
    if (!mood) continue;
    mood.look.forEach((name) => look.add(K[name]));
    mood.avoid.forEach((name) => avoid.add(K[name]));
  }
  look.forEach((id) => avoid.delete(id));
  return { look: [...look], avoid: [...avoid] };
}

module.exports = { moodKeywords, MOOD_KEYWORDS, KEYWORD_IDS: K };
