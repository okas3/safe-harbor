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
export const PASS_THRESHOLD = 90;

function defaultEntry() {
  return {
    stage: 'new', // new -> recognized -> cued -> free -> mastered -> maintenance
    interval: 0,
    ease: 2.5,
    dueDate: null,
    lastReviewed: null,
    reps: 0,
    lapses: 0,
    wordMisses: {},
    scenarioVisited: false
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

// Distinct from recordRecognition — this specifically means "played
// this verse's scenario as a quiz," not "recognized it in a normal
// drill mode." Only a completed Situations Match round should call
// this; Dead Reckoning/Safe Harbor never should.
export function markScenarioVisited(ref) {
  const e = entryFor(ref);
  if (!e.scenarioVisited) {
    e.scenarioVisited = true;
    saveProgress();
  }
}

// The single source of truth for what ambient scenario prompts are
// allowed to draw from — a verse with real SM-2 progress (learned)
// or one encountered via a completed scenario quiz (visited). Either
// is enough; this is deliberately an OR, not a stricter AND.
export function isLearnedOrVisited(ref) {
  const e = getProgress(ref);
  return !!e.dueDate || !!e.scenarioVisited;
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

const STREAK_KEY = 'scripture-streak-v1';
let streak = { current: 0, lastDate: null };
let streakDb = null;

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadStreak() {
  try {
    streakDb = (typeof window !== 'undefined' && window.claude?.use) ? await window.claude.use('db') : null;
    if (streakDb) {
      const snap = await streakDb.doc('streak/log').get();
      streak = snap.exists ? snap.data() : { current: 0, lastDate: null };
    } else {
      streak = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null') || { current: 0, lastDate: null };
    }
  } catch (e) {
    try { streak = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null') || { current: 0, lastDate: null }; }
    catch (e2) { streak = { current: 0, lastDate: null }; }
  }
  return streak;
}

async function saveStreak() {
  try {
    if (streakDb) await streakDb.doc('streak/log').set(streak);
    else localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch (e) {}
}

// Called once per completed practice session (any mode). A day only
// extends the streak if the previous counted day was exactly
// yesterday — a gap of two or more days resets it to 1, and a second
// session on the same day is a no-op rather than double-counting.
export function recordActivity() {
  const todayKey = localDateKey(new Date());
  if (streak.lastDate === todayKey) return streak;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  streak.current = streak.lastDate === localDateKey(yesterday) ? streak.current + 1 : 1;
  streak.lastDate = todayKey;
  saveStreak();
  return streak;
}

// A streak display shouldn't keep showing "3 days" forever once
// you've actually missed a day — it only counts if the last logged
// activity was today or yesterday (still extendable today).
export function getStreak() {
  if (!streak.lastDate) return 0;
  const todayKey = localDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (streak.lastDate !== todayKey && streak.lastDate !== localDateKey(yesterday)) return 0;
  return streak.current;
}

// Flattens every verse across every category, returns the ones
// genuinely due for reinforcement — an actual dueDate in the past,
// meaning it's been through recall-based practice before and is now
// fading. Most overdue first, each carrying its suggested next mode.
//
// Deliberately excludes never-scheduled verses (no dueDate at all) —
// those aren't "due," they're just unstarted. Lumping them in used to
// mean a never-touched verse could out-rank a genuinely-decaying one
// in the queue (the old sort's `?? 9999` fallback made "never
// scheduled" look like the single most overdue thing on record) and
// flooded Review with first-exposure verses instead of reinforcement.
// See getNewVerses() for the never-scheduled count.
export function getDueVerses(DATA) {
  const now = Date.now();
  const due = [];
  DATA.forEach(group => {
    group.verses.forEach(v => {
      const e = getProgress(v.ref);
      if (e.dueDate && new Date(e.dueDate).getTime() <= now) {
        due.push({
          cat: group.cat,
          ref: v.ref,
          stage: e.stage,
          overdueDays: Math.floor((now - new Date(e.dueDate).getTime()) / 86400000),
          suggested: suggestedModeForStage(e.stage)
        });
      }
    });
  });
  due.sort((a, b) => b.overdueDays - a.overdueDays);
  return due;
}

// Verses with no dueDate yet — never been through a recall-based
// session (recognition alone, via Dead Reckoning/Safe Harbor, doesn't
// establish a review schedule). These want first exposure via a
// category's normal practice flow, not a reinforcement queue.
export function getNewVerses(DATA) {
  const list = [];
  DATA.forEach(group => {
    group.verses.forEach(v => {
      if (!getProgress(v.ref).dueDate) list.push({ cat: group.cat, ref: v.ref });
    });
  });
  return list;
}

// New-card introduction pacing: caps how many never-seen verses get
// exposed per day (dumping all 28 into rotation on day one defeats
// the point of spacing them out) and interleaves across categories
// so early coverage spans every theme instead of finishing one
// category before starting the next.
export const NEW_VERSES_PER_DAY = 5;

const NEWCARDS_KEY = 'scripture-newcard-v1';
let newcards = { date: null, refs: [] };
let newcardsDb = null;

export async function loadNewCardState() {
  try {
    newcardsDb = (typeof window !== 'undefined' && window.claude?.use) ? await window.claude.use('db') : null;
    if (newcardsDb) {
      const snap = await newcardsDb.doc('newcards/log').get();
      newcards = snap.exists ? snap.data() : { date: null, refs: [] };
    } else {
      newcards = JSON.parse(localStorage.getItem(NEWCARDS_KEY) || 'null') || { date: null, refs: [] };
    }
  } catch (e) {
    try { newcards = JSON.parse(localStorage.getItem(NEWCARDS_KEY) || 'null') || { date: null, refs: [] }; }
    catch (e2) { newcards = { date: null, refs: [] }; }
  }
  return newcards;
}

async function saveNewCardState() {
  try {
    if (newcardsDb) await newcardsDb.doc('newcards/log').set(newcards);
    else localStorage.setItem(NEWCARDS_KEY, JSON.stringify(newcards));
  } catch (e) {}
}

// A verse is "introduced" the moment it's placed into a day's batch
// (shown), not once actually attempted — gating on attempt would need
// hooking into every mode's abandon path, and re-rolling the batch for
// someone who opened a verse then left would reintroduce the exact
// "fresh batch on every reload" problem this exists to prevent. It
// only bounds how many new verses are exposed per day; a verse that
// never actually gets practiced still has no dueDate and still shows
// up via getNewVerses() on later days.
export function getTodaysNewBatch(DATA) {
  const todayKey = localDateKey(new Date());
  if (newcards.date === todayKey) {
    const chosen = [];
    DATA.forEach(group => {
      group.verses.forEach(v => {
        if (newcards.refs.includes(v.ref)) chosen.push({ cat: group.cat, ref: v.ref });
      });
    });
    return chosen;
  }

  const byCategory = DATA.map(group => ({
    cat: group.cat,
    refs: getNewVerses([group]).map(x => x.ref)
  }));
  const chosen = [];
  let progressed = true;
  while (chosen.length < NEW_VERSES_PER_DAY && progressed) {
    progressed = false;
    for (const cat of byCategory) {
      if (chosen.length >= NEW_VERSES_PER_DAY) break;
      const next = cat.refs.shift();
      if (next) { chosen.push({ cat: cat.cat, ref: next }); progressed = true; }
    }
  }

  newcards = { date: todayKey, refs: chosen.map(c => c.ref) };
  saveNewCardState();
  return chosen;
}

// The due-today home queue: genuinely-decaying reinforcement first
// (the urgent part of spaced repetition), today's fresh-verse batch
// appended after — one combined session instead of two screens.
export function getDueTodayQueue(DATA) {
  const due = getDueVerses(DATA);
  const fresh = getTodaysNewBatch(DATA).map(({ cat, ref }) => ({
    cat, ref, stage: 'new', overdueDays: null, suggested: suggestedModeForStage('new')
  }));
  return [...due, ...fresh];
}

// Ambient scenario prompts: at most one per day, and not a repeat of
// whichever situation was shown last — the actual eligibility check
// (learned-or-visited) lives in isLearnedOrVisited() above; this file
// only tracks the pacing/no-immediate-repeat state, since picking a
// situation itself needs scenarios.js data this module doesn't import.
const AMBIENT_KEY = 'scripture-ambient-v1';
let ambient = { date: null, lastSituation: null };
let ambientDb = null;

export async function loadAmbientState() {
  try {
    ambientDb = (typeof window !== 'undefined' && window.claude?.use) ? await window.claude.use('db') : null;
    if (ambientDb) {
      const snap = await ambientDb.doc('ambient/log').get();
      ambient = snap.exists ? snap.data() : { date: null, lastSituation: null };
    } else {
      ambient = JSON.parse(localStorage.getItem(AMBIENT_KEY) || 'null') || { date: null, lastSituation: null };
    }
  } catch (e) {
    try { ambient = JSON.parse(localStorage.getItem(AMBIENT_KEY) || 'null') || { date: null, lastSituation: null }; }
    catch (e2) { ambient = { date: null, lastSituation: null }; }
  }
  return ambient;
}

async function saveAmbientState() {
  try {
    if (ambientDb) await ambientDb.doc('ambient/log').set(ambient);
    else localStorage.setItem(AMBIENT_KEY, JSON.stringify(ambient));
  } catch (e) {}
}

// True once today's ambient prompt has already been shown — the
// selection algorithm in app.js checks this before doing any picking.
export function ambientAlreadyShownToday() {
  return ambient.date === localDateKey(new Date());
}

export function getLastAmbientSituation() {
  return ambient.lastSituation;
}

export function recordAmbientShown(situationKey) {
  ambient = { date: localDateKey(new Date()), lastSituation: situationKey };
  saveAmbientState();
}
