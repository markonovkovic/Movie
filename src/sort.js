'use strict';

// A–Z like a phone's contact list: titles starting with a letter first (accents and case
// ignored, "Amélie" sits with the A's), then those starting with a number. Leading quotes,
// brackets and symbols are skipped, so "#Alive" is under A and "(500) Days of Summer" under 5.
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function sortKey(title) {
  return String(title || '').replace(/^[^\p{L}\p{N}]+/u, '');
}

function compareTitles(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  const ga = /^\p{L}/u.test(ka) ? 0 : 1;
  const gb = /^\p{L}/u.test(kb) ? 0 : 1;
  return ga - gb || collator.compare(ka, kb) || collator.compare(String(a), String(b));
}

module.exports = { compareTitles, sortKey };
