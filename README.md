# Safe Harbor — Anchor Scriptures

A scripture memorization app with four practice modes (Fathom by Fathom,
Chain of Initials, By Heart, Safe Harbor) across seven categories of
ESV verses, each with objective word-level grading and a persistent
history log.

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

Outputs a static site to `dist/` — deployable to Vercel, Netlify, GitHub
Pages, or any static host.

## Project structure

- `index.html` — page shell and view markup
- `src/app.js` — all app logic (state machine, grading, history)
- `src/verses.js` — the verse data (7 categories × 4 verses)
- `src/difficulties.js` — difficulty tier definitions per mode
- `src/style.css` — the deep-sea/nautical visual theme
- `legacy/original-single-file.html` — the original single-file version
  this was split from, kept for reference

## History storage

Scores/attempts save to `localStorage` in a normal browser. If this page
is ever published as a Claude Artifact with the `db` capability
declared, it uses that instead so history persists across devices.
