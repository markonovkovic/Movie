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

module.exports = { parseGenres, ALL_GENRES, GENRE_WORDS };
