// `name` is the full descriptive label for the mode-select dropdown
// ("Easy (One Category)"); `short` is just the tier word, for compact
// title bars (round header, score screen) where stacking that same
// descriptive text after the mode name with its own separator reads
// as visual noise (e.g. "Safe Harbor · Easy (One Category)").
export const FADE_DIFFS = [
  { id: 'veryeasy', name: 'Very Easy (10% Blanked)', short: 'Very Easy', frac: 0.10 },
  { id: 'easy', name: 'Easy (25% Blanked)', short: 'Easy', frac: 0.25 },
  { id: 'normal', name: 'Medium (50% Blanked)', short: 'Medium', frac: 0.50 },
  { id: 'hard', name: 'Hard (75% Blanked)', short: 'Hard', frac: 0.75 },
  { id: 'nocues', name: 'Very Hard (Nearly All Blanked)', short: 'Very Hard', frac: 0.92 }
];

export const LETTER_DIFFS = [
  { id: 'normal', name: 'Easy (Every Word Cued)', short: 'Easy', every: 1 },
  { id: 'hard', name: 'Hard (Every Other Word Cued)', short: 'Hard', every: 2 }
];

const ONE_CATEGORY_DIFFS = [
  { id: 'easy', name: 'Easy (One Category)', short: 'Easy' },
  { id: 'hard', name: 'Hard (Mixed Categories)', short: 'Hard' }
];

export const MATCH_DIFFS = ONE_CATEGORY_DIFFS;
export const REVERSE_DIFFS = ONE_CATEGORY_DIFFS;

// Preview and Match are recognition-only; By Heart is the deliberately
// hard, opt-in free-recall tier — never the entry point into a new
// situation.
export const SCENARIO_DIFFS = [
  { id: 'preview', name: 'Preview (See the Connection)', short: 'Preview' },
  { id: 'match', name: 'Match (Tap to Pair)', short: 'Match' },
  { id: 'byheart', name: 'By Heart (Free Recall)', short: 'By Heart' }
];
