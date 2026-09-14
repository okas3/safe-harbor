export const FADE_DIFFS = [
  { id: 'veryeasy', name: 'The Shallows', sub: '~10% of words blanked', frac: 0.10 },
  { id: 'easy', name: 'The Shoals', sub: '~25% of words blanked', frac: 0.25 },
  { id: 'normal', name: 'Open Water', sub: '~50% of words blanked', frac: 0.50 },
  { id: 'hard', name: 'The Deep', sub: '~75% of words blanked', frac: 0.75 },
  { id: 'nocues', name: 'The Abyss', sub: 'Nearly the whole verse blanked', frac: 0.92 }
];

export const LETTER_DIFFS = [
  { id: 'normal', name: 'Every Link', sub: 'Initial of every word', every: 1 },
  { id: 'hard', name: 'Every Other Link', sub: 'Initial of every other word only', every: 2 }
];

export const MATCH_DIFFS = [
  { id: 'easy', name: 'Home Port', sub: 'This category only — 4 pairs, full text' },
  { id: 'hard', name: 'Open Sea', sub: '8 pairs mixed with another category, short snippets' }
];
