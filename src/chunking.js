// Splits verse text into phrase-level chunks for the Anchor Chain
// Build mode's cumulative recall technique — memorize phrase 1, add
// phrase 2 and recite both, add phrase 3, and so on. This is the
// classic "chaining" memorization technique, needed once verses (or
// eventually full passages) get long enough that treating the whole
// thing as one atomic recall unit stops being realistic.
const MAX_CHUNK_WORDS = 8;

export function chunkVerse(text) {
  // Split on sentence/clause punctuation, keeping the delimiter
  // attached to the piece that precedes it.
  const rough = text.match(/[^,;.:!?]+[,;.:!?]*/g) || [text];
  const chunks = [];
  rough.forEach(piece => {
    const trimmed = piece.trim();
    if (!trimmed) return;
    const words = trimmed.split(' ');
    if (words.length <= MAX_CHUNK_WORDS) {
      chunks.push(trimmed);
    } else {
      // Long unpunctuated clause — fall back to fixed-size pieces so
      // no single chunk is unreasonably long to hold in working memory.
      for (let i = 0; i < words.length; i += MAX_CHUNK_WORDS) {
        chunks.push(words.slice(i, i + MAX_CHUNK_WORDS).join(' '));
      }
    }
  });
  // Merge a stray tiny trailing piece (e.g. a lone "God," left over
  // after a fixed-size split) into the chunk before it rather than
  // leaving an oddly small, isolated link in the chain.
  const merged = [];
  chunks.forEach(c => {
    if (merged.length && c.split(' ').length < 3) merged[merged.length - 1] += ' ' + c;
    else merged.push(c);
  });
  return merged.length ? merged : [text];
}
