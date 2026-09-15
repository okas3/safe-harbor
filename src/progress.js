// Per-verse long-term learning state: spaced-repetition scheduling
// (simplified SM-2), mastery stage, and weak-word tracking. This is
// deliberately separate from history.js's flat attempt log — history
// answers "what did you do," this answers "what do you actually know,
// and when will you forget it."
//
// Recognition modes (Safe Harbor, Dead Reckoning) only ever call
// recordRecognition() — they can prove you recognize a verse, not that
// you can produce it, so they never touch the SM-2 schedule. Only
// recall modes (graded via checkFade/checkType) call recordRecall().

const PROGRESS_KEY = 'scripture-progress-v1';
const PASS_THRESHOLD = 90;

function defaultEntry() {
  return {
    stage: 'new', // new -> recognized -> cued -> free -> mastered -> maintenance
    interval: 0,
    ease: 2.5,
    dueDate: null,
    lastReviewed: null,
    reps: 0,
    lapses: 0,
    wordMisses: {}
  };
}

let progress = {};
let progressDb = null;

export async function loadProgress() {
  try {
    progressDb = (typeof window !== 'undefined' && window.claude?.use)
      ? await window.claude.use('db')
      : null;
    if (progressDb) {
      const snap = await progressDb.doc('progress/log').get();
      progress = snap.exists ? (snap.data().entries || {}) : {};
    } else {
      progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    }
  } catch (e) {
    try { progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
    catch (e2) { progress = {}; }
  }
  return progress;
}

async function saveProgress() {
  try {
    if (progressDb) {
      await progressDb.doc('progress/log').set({ entries: progress });
    } else {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    }
  } catch (e) {}
}

function entryFor(ref) {
  if (!progress[ref]) progress[ref] = defaultEntry();
  return progress[ref];
}

export function getProgress(ref) {
  return progress[ref] || defaultEntry();
}

export function recordRecognition(ref) {
  const e = entryFor(ref);
  if (e.stage === 'new') e.stage = 'recognized';
  saveProgress();
  return e;
}

// `depth` distinguishes the two recall-mode grading paths: checkFade()
// (a cued test — the rest of the verse stays visible) is 'cued', while
// checkType() (a bare textarea, used by both Chain of Initials's final
// step and By Heart) is 'free' — the graded moment there is cue-free
// regardless of which mode led into it.
export function recordRecall(ref, score, depth) {
  const e = entryFor(ref);
  const pass = score >= PASS_THRESHOLD;
  e.lastReviewed = new Date().toISOString();

  if (!pass) {
    e.lapses += 1;
    e.reps = 0;
    e.ease = Math.max(1.3, e.ease - 0.2);
    e.interval = 1;
    // A lapse means a "mastered" verse wasn't actually holding — drop
    // it back to 'cued' to be re-proven, but never below what's
    // already been demonstrated at least once.
    if (e.stage === 'mastered' || e.stage === 'maintenance') e.stage = 'cued';
  } else {
    e.reps += 1;
    if (e.reps === 1) e.interval = 1;
    else if (e.reps === 2) e.interval = 6;
    else e.interval = Math.round(e.interval * e.ease);
    // Standard SM-2 ease update, with `score` (0-100) mapped onto the
    // algorithm's usual 0-5 quality scale.
    const q = (score / 100) * 5;
    e.ease = Math.max(1.3, e.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

    if (e.stage === 'new' || e.stage === 'recognized') e.stage = 'cued';
    if (depth === 'free' && e.stage === 'cued') e.stage = 'free';
    // Mastered (and maintenance beyond it) must be earned by proven
    // free recall, not just enough cued-mode reps piling up interval —
    // otherwise the badge would claim you can produce a verse cold
    // when you've only ever recalled it with cues still showing.
    if (e.stage === 'free' && e.reps >= 5 && e.interval >= 30) e.stage = 'mastered';
    if (e.stage === 'mastered' && e.interval >= 90) e.stage = 'maintenance';
  }

  const due = new Date();
  due.setDate(due.getDate() + e.interval);
  e.dueDate = due.toISOString();

  saveProgress();
  return e;
}

export function recordWordMisses(ref, missedWords) {
  if (!missedWords || !missedWords.length) return;
  const e = entryFor(ref);
  missedWords.forEach(w => {
    if (!w) return;
    e.wordMisses[w] = (e.wordMisses[w] || 0) + 1;
  });
  saveProgress();
}

// Called when a word flagged as weak gets answered correctly during a
// Weak Link drill — lets a word earn its way off the list instead of
// staying flagged forever once it's actually been fixed.
export function resolveWordMiss(ref, word) {
  const e = entryFor(ref);
  if (e.wordMisses[word]) {
    e.wordMisses[word] -= 1;
    if (e.wordMisses[word] <= 0) delete e.wordMisses[word];
    saveProgress();
  }
}

// Suggested mode for wherever a verse currently sits in the
// recognition -> cued -> free -> mastered curriculum. `diffId` refers
// to an id within that mode's difficulty array (resolved by the
// caller, which has access to difficulties.js — kept out of this file
// to avoid a circular/unnecessary coupling).
export function suggestedModeForStage(stage) {
  switch (stage) {
    case 'new': return { mode: 'reverse', diffId: 'easy' };
    case 'recognized': return { mode: 'fade', diffId: 'easy' };
    case 'cued': return { mode: 'fade', diffId: 'hard' };
    case 'free': return { mode: 'type', diffId: null };
    default: return { mode: 'type', diffId: null }; // mastered / maintenance
  }
}

// Flattens every verse across every category, returns the ones due for
// review (dueDate in the past, or never scheduled at all), most
// overdue first, each carrying its suggested next mode.
export function getDueVerses(DATA) {
  const now = Date.now();
  const due = [];
  DATA.forEach(group => {
    group.verses.forEach(v => {
      const e = getProgress(v.ref);
      const isDue = !e.dueDate || new Date(e.dueDate).getTime() <= now;
      if (isDue) {
        due.push({
          cat: group.cat,
          ref: v.ref,
          stage: e.stage,
          overdueDays: e.dueDate ? Math.floor((now - new Date(e.dueDate).getTime()) / 86400000) : null,
          suggested: suggestedModeForStage(e.stage)
        });
      }
    });
  });
  due.sort((a, b) => (b.overdueDays ?? 9999) - (a.overdueDays ?? 9999));
  return due;
}
