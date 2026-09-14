# Safe Harbor — Anchor Scriptures

A scripture memorization app built around one idea: practicing the
right way, at the right time, matters more than practicing harder. It
covers seven categories of ESV verses across seven practice modes,
each grading an actual attempt (not just "did you read it"), plus a
spaced-repetition layer that tracks what's actually at risk of being
forgotten. See [The Science Behind It](#the-science-behind-it) below —
or the in-app "About the method" link at the bottom of the home
screen — for why it's built this way.

## Practice modes

- **Safe Harbor** — tap-to-pair every reference against every verse
  snippet in a category, timed
- **Dead Reckoning** — verse text shown, no reference; pick the right
  one from a few options
- **Fathom by Fathom** — fill-in-the-blank at five difficulty tiers
  (10% to ~92% of words hidden)
- **Chain of Initials** — first-letter cues, then the full verse typed
  from memory
- **Weak Link** — re-drills only the specific words you keep missing
- **Anchor Chain Build** — memorize a verse phrase by phrase,
  cumulatively
- **By Heart** — reference only, the whole verse typed cold

## Run it locally

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. Note: the `/api` route (image
uploads for memory hooks) isn't served by plain `npm run dev` — that
needs `vercel dev` or a real deploy; everything else works fine
locally.

## Build for deployment

```
npm run build
```

Outputs a static site to `dist/`. Deployed on Vercel; the `/api`
function additionally requires Blob storage enabled on the Vercel
project (Dashboard → Storage → create a Blob store → link it) to
provision `BLOB_READ_WRITE_TOKEN`.

## Project structure

- `index.html` — page shell and view markup
- `src/app.js` — app logic: state machine, grading, rendering
- `src/verses.js` — verse data (7 categories × 4 verses, `tags: []`
  scaffolded for future thematic linking)
- `src/difficulties.js` — difficulty tier definitions per mode
- `src/icons.js` — hand-drawn SVG category icons
- `src/progress.js` — spaced-repetition and mastery-stage tracking
  (simplified SM-2), weak-word tracking, memory hooks
- `src/chunking.js` — phrase-splitting for Anchor Chain Build
- `api/upload-hook-image.js` — Vercel serverless function storing
  memory-hook images via `@vercel/blob`
- `src/style.css` — the deep-sea/nautical visual theme
- `MEMORY-SYSTEM-REVIEW.md` — the design rationale for the
  spaced-repetition/mastery layer, written up as an expert-mnemonist
  critique with a prioritized roadmap
- `legacy/original-single-file.html` — the original single-file
  version this was split from, kept for reference

## History & progress storage

Both the attempt history and the spaced-repetition progress data save
to `localStorage` in a normal browser. If this page is ever published
as a Claude Artifact with the `db` capability declared, it uses that
instead so data persists across devices.

## The Science Behind It

**Active recall.** Re-reading a verse feels productive, but the thing
that actually builds durable memory is retrieval — closing your eyes
and trying to produce it from nothing. This is the testing effect
(Roediger & Karpicke), and it's why every mode here grades an actual
attempt rather than just letting you re-read and move on.

**A curriculum, not five unrelated modes.** Safe Harbor and Dead
Reckoning are recognition tasks — useful for building initial
familiarity, but passing them doesn't prove you could recite the
verse. Chain of Initials and mid-tier Fathom by Fathom are cued
recall. By Heart and high-tier Fathom by Fathom are free recall — the
real target. The app tracks which stage a verse has reached and
suggests the next mode accordingly, rather than leaving a beginner to
accidentally attempt cold recall on something they've never studied.

**Spaced repetition.** Left alone, memory decays on a predictable
curve (Ebbinghaus) — fast at first, then slower. `src/progress.js`
implements a simplified SM-2 scheduler: each verse gets an interval
and ease factor that grow when you recall it successfully and reset
when you don't, and the Review queue surfaces whatever is actually due
across every category — not just whichever one you feel like
practicing.

**Weak-word isolation.** Most tools re-test a whole passage every time
you miss one word. Weak Link tracks per-word miss counts and drills
just the specific words that keep tripping you up, still in the
context of the verse.

**Dual coding.** Pairing verbal memory with a visual or spatial one
(Paivio) measurably strengthens recall for a lot of people. Memory
hooks — an optional note or image pinned to a verse — surface during
every recall mode as a cue, and are deliberately withheld from the two
recognition modes, where they'd just give away the answer.
