# Anchor Scriptures

A scripture memorization app: seven categories of ESV verses, seven
practice modes, and a spaced-repetition layer tracking what's actually
at risk of being forgotten. For the reasoning behind the design, see
the in-app "About the method" link at the bottom of the home screen
(or `MEMORY-SYSTEM-REVIEW.md` for the full technical writeup).

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

Opens at `http://localhost:5173`.

## Build for deployment

```
npm run build
```

Outputs a static site to `dist/`.

## Project structure

- `index.html` — page shell and view markup
- `src/app.js` — app logic: state machine, grading, rendering
- `src/verses.js` — verse data (7 categories × 4 verses)
- `src/difficulties.js` — difficulty tier definitions per mode
- `src/icons.js` — hand-drawn SVG category icons
- `src/progress.js` — spaced-repetition and mastery-stage tracking
  (simplified SM-2), weak-word tracking
- `src/chunking.js` — phrase-splitting for Anchor Chain Build
- `src/style.css` — the deep-sea/nautical visual theme
- `MEMORY-SYSTEM-REVIEW.md` — the design rationale for the
  spaced-repetition/mastery layer, written up as an expert-mnemonist
  critique with a prioritized roadmap

## History & progress storage

Both the attempt history and the spaced-repetition progress data save
to `localStorage` in a normal browser. If this page is ever published
as a Claude Artifact with the `db` capability declared, it uses that
instead so data persists across devices.
