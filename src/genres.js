'use strict';

// Words people use for each genre. Phrases are matched as whole words, case-insensitively.
const GENRE_WORDS = {
  Action: ['action', 'fight', 'fights', 'fighting', 'explosions', 'superhero', 'superheroes', 'martial arts', 'kung fu'],
  Adventure: ['adventure', 'adventures', 'adventurous', 'quest', 'journey', 'epic', 'treasure'],
  Animation: ['animation', 'animated', 'cartoon', 'cartoons', 'anime', 'pixar'],
  Biography: ['biography', 'biographical', 'biopic', 'biopics', 'true story', 'true stories', 'real story', 'based on a true story'],
  Comedy: ['comedy', 'comedies', 'funny', 'laugh', 'laughs', 'hilarious', 'humor', 'humour', 'comedic', 'silly', 'lighthearted', 'light hearted'],
  Crime: ['crime', 'criminal', 'gangster', 'gangsters', 'mafia', 'mob', 'heist', 'heists', 'detective', 'cop', 'cops', 'police'],
  Documentary: ['documentary', 'documentaries', 'docu', 'doc', 'docs', 'nature'],
  Drama: ['drama', 'dramas', 'dramatic', 'emotional', 'tearjerker', 'tear jerker', 'serious'],
  Family: ['family', 'kids', 'kid', 'children', 'child', 'kid friendly', 'family friendly'],
  Fantasy: ['fantasy', 'magic', 'magical', 'wizard', 'wizards', 'dragon', 'dragons', 'fairy tale', 'fairytale', 'mythical'],
  History: ['history', 'historical', 'period', 'period piece', 'ancient', 'medieval'],
  Horror: ['horror', 'scary', 'scare', 'creepy', 'spooky', 'terrifying', 'zombie', 'zombies', 'ghost', 'ghosts', 'slasher', 'haunted', 'vampire', 'vampires'],
  Music: ['music', 'musical', 'musicals', 'singing', 'songs', 'dance', 'dancing', 'band', 'concert'],
  Mystery: ['mystery', 'mysteries', 'mysterious', 'whodunit', 'whodunnit', 'puzzle', 'twist', 'twists'],
  Romance: ['romance', 'romantic', 'love story', 'love stories', 'love', 'romcom', 'romcoms', 'rom com', 'rom coms', 'date night'],
  'Sci-Fi': ['sci-fi', 'sci fi', 'scifi', 'science fiction', 'space', 'aliens', 'alien', 'robot', 'robots', 'future', 'futuristic', 'time travel', 'dystopian', 'cyberpunk'],
  Sport: ['sport', 'sports', 'football', 'soccer', 'boxing', 'basketball', 'baseball', 'tennis', 'racing'],
  Thriller: ['thriller', 'thrillers', 'suspense', 'suspenseful', 'tense', 'psychological', 'edge of my seat', 'gripping'],
  War: ['war', 'wars', 'military', 'soldier', 'soldiers', 'battle', 'battles', 'ww2', 'wwii'],
  Western: ['western', 'westerns', 'cowboy', 'cowboys', 'wild west'],
};
// Words that mean two genres at once.
const COMBOS = { romcom: ['Romance', 'Comedy'], romcoms: ['Romance', 'Comedy'], 'rom com': ['Romance', 'Comedy'], 'rom coms': ['Romance', 'Comedy'] };

const ALL_GENRES = Object.keys(GENRE_WORDS);

// Longest phrases first, so "science fiction" wins over "fiction"-like partial words.
const PHRASES = Object.entries(GENRE_WORDS)
  .flatMap(([genre, words]) => words.map((w) => ({ phrase: w, genres: COMBOS[w] || [genre] })))
  .sort((a, b) => b.phrase.length - a.phrase.length);

function normalize(text) {
  return ` ${String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * Finds the genres mentioned in free text ("something funny with aliens" -> Comedy, Sci-Fi).
 * Exact genre names are also accepted. Returns { genres, matched } in order of appearance.
 */
function parseGenres(text) {
  let rest = normalize(text);
  const found = [];
  for (const { phrase, genres } of PHRASES) {
    const needle = ` ${normalize(phrase).trim()} `;
    const at = rest.indexOf(needle);
    if (at === -1) continue;
    found.push({ at, phrase, genres });
    rest = rest.slice(0, at) + ' '.repeat(needle.length - 1) + rest.slice(at + needle.length - 1); // consume it
  }
  found.sort((a, b) => a.at - b.at);
  const genres = [...new Set(found.flatMap((f) => f.genres))];
  return { genres, matched: found.map((f) => f.phrase) };
}

// Styles: popular kinds of film that aren't TMDB genres, found by TMDB keywords (IDs from
// /search/keyword), optionally within genres (all of them). `local` are the genres used when
// falling back to the built-in list, which has no keywords.
const STYLES = {
  Superhero: { keywords: [9715], local: ['Action'] },
  Anime: { keywords: [210024], genres: ['Animation'], local: ['Animation'] },
  Romcom: { genres: ['Romance', 'Comedy'], local: ['Romance', 'Comedy'] },
  'True Story': { keywords: [9672, 5565], local: ['Biography'] },
  Musical: { keywords: [4344], local: ['Music'] },
  Sports: { keywords: [6075], local: ['Sport'] },
  Christmas: { keywords: [207317], local: ['Family'] },
  'Coming of Age': { keywords: [10683], local: ['Drama'] },
  Heist: { keywords: [10051], local: ['Crime'] },
  Spy: { keywords: [470], local: ['Thriller'] },
  'Martial Arts': { keywords: [779], local: ['Action'] },
  'Time Travel': { keywords: [4379], local: ['Sci-Fi'] },
  Space: { keywords: [9882, 3801], local: ['Sci-Fi'] },
  Dystopia: { keywords: [4565, 4458], local: ['Sci-Fi'] },
  Zombie: { keywords: [12377], local: ['Horror'] },
  'Serial Killer': { keywords: [10714], local: ['Thriller'] },
  Psychological: { keywords: [12565], local: ['Thriller'] },
  Disaster: { keywords: [10617, 5096], local: ['Action'] },
  Monster: { keywords: [1299, 11100], local: ['Horror'] },
  'Road Trip': { keywords: [7312], local: ['Comedy'] },
  'Stand-up': { keywords: [9716], local: ['Comedy'] },
};
const ALL_STYLES = Object.keys(STYLES);

module.exports = { parseGenres, ALL_GENRES, GENRE_WORDS, STYLES, ALL_STYLES };
