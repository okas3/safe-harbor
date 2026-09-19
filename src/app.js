import './style.css';
import { DATA } from './verses.js';
import { FADE_DIFFS, LETTER_DIFFS, MATCH_DIFFS, REVERSE_DIFFS, SCENARIO_DIFFS } from './difficulties.js';
import { CATEGORY_ICONS, ANCHOR_ICON } from './icons.js';
import { loadProgress, recordRecognition, recordRecall, recordWordMisses, resolveWordMiss, getProgress, getDueVerses, getDueTodayQueue, loadNewCardState, suggestedModeForStage, PASS_THRESHOLD, loadStreak, recordActivity, getStreak, markScenarioVisited, isLearnedOrVisited, loadAmbientState, ambientAlreadyShownToday, getLastAmbientSituation, recordAmbientShown } from './progress.js';
import { chunkVerse } from './chunking.js';
import { SCENARIOS, SCENARIO_MATCH_MIN } from './scenarios.js';

document.getElementById('h1Mark').innerHTML = ANCHOR_ICON;

// A network-first service worker keeps this current while online, but
// a tab that's already open when a new one activates doesn't get the
// new fetch behavior until it reloads — reload once, automatically,
// the moment a new service worker actually takes control, rather than
// leaving a visitor stuck looking at whatever loaded first today.
if ('serviceWorker' in navigator) {
  let reloadedForNewSW = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewSW) return;
    reloadedForNewSW = true;
    window.location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

const HISTORY_KEY = 'scripture-history-v3';

const MODES = [
  { id: 'match', label: 'Safe Harbor', hint: 'Match the Pairs', desc: 'All references and verses laid out at once. Tap to pair them correctly, race the clock.' },
  { id: 'reverse', label: 'Dead Reckoning', hint: 'Name the Reference', desc: 'Read the verse with no reference shown, then pick which passage it comes from.' },
  { id: 'fade', label: 'Fathom by Fathom', hint: 'Fill in the Blanks', desc: 'Words go blank as you dial up the depth. Type the missing word in place, graded on the spot.' },
  { id: 'letters', label: 'Chain of Initials', hint: 'First-Letter Cues', desc: 'Only initials shown. Recite from the skeleton, then type the full verse to be graded.' },
  { id: 'weaklink', label: 'Weak Link', hint: 'Drill Your Misses', desc: 'Only the specific words you keep getting wrong are blanked. Everything else stays visible for context.' },
  { id: 'chainbuild', label: 'Anchor Chain Build', hint: 'Build It Phrase by Phrase', desc: 'Add one phrase at a time, reciting everything built so far before the next link goes on.' },
  { id: 'type', label: 'By Heart', hint: 'Type from Memory', desc: 'Just the reference. Type the whole verse. Graded word by word.' }
];

// Situations aren't scoped to one category the way every mode above
// is, so they don't live in the category-picker's mode-select at all
// — this is a separate label just for history/title display.
const SCENARIO_MODE_LABEL = 'Compass Bearing';
const STAGE_LABELS = { new: 'New', recognized: 'Recognized', cued: 'Cued', free: 'Free Recall', mastered: 'Mastered', maintenance: 'Maintained' };
const STAGE_RANK = { new: 0, recognized: 1, cued: 2, free: 3, mastered: 4, maintenance: 5 };

function diffsForMode(mode) {
  return mode === 'fade' ? FADE_DIFFS
    : mode === 'letters' ? LETTER_DIFFS
    : mode === 'match' ? MATCH_DIFFS
    : mode === 'reverse' ? REVERSE_DIFFS
    : null;
}

let state = {
  cat: DATA[0].cat, mode: 'match', difficulty: MATCH_DIFFS[0],
  sessionVerses: [], stepIndex: 0, results: [],
  startTime: 0, lastConfig: null
};
let matchState = null;

buildModeOptions();
document.getElementById('modeSelect').addEventListener('change', onModeSelectChange);

// The verse list's top/bottom fades should reflect actual scroll
// position, not just "there might be more" — a top fade with nothing
// above it, or a bottom fade still showing once you've scrolled all
// the way down, both misrepresent the state of the box. #verseList
// itself persists across renders (only its innerHTML is replaced), so
// this listener is attached once, not re-added per render.
function updateVerseListFades() {
  const el = document.getElementById('verseList');
  const wrap = document.querySelector('.verse-list-wrap');
  if (!el || !wrap) return;
  wrap.classList.toggle('show-top-fade', el.scrollTop > 4);
  wrap.classList.toggle('show-bottom-fade', el.scrollTop + el.clientHeight < el.scrollHeight - 4);
}
document.getElementById('verseList').addEventListener('scroll', updateVerseListFades);

// Quiz check/submit via Enter. Blank-fill inputs are single-line, so
// plain Enter is unambiguous. typeInput is a textarea where Enter's
// native job is a newline (verses can span lines), so that one needs
// Cmd/Ctrl+Enter instead of hijacking plain Enter.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const target = e.target;
  if (target.classList && target.classList.contains('blank-input')) {
    e.preventDefault();
    if (state.mode === 'fade') checkFade();
    else if (state.mode === 'weaklink') checkWeakLink();
  } else if (target.id === 'typeInput' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (state.mode === 'chainbuild') checkChainBuild();
    else checkType();
  }
});

let history = [];
let db = null;

async function loadHistory() {
  try {
    // window.claude only exists when this page runs inside a Claude
    // Artifact — everywhere else (a plain browser, this Vite build)
    // it's simply absent, so check via `window` rather than
    // referencing the bare identifier (which would throw and skip
    // the localStorage fallback below entirely).
    db = (typeof window !== 'undefined' && window.claude?.use)
      ? await window.claude.use('db')
      : null;
    if (db) {
      const snap = await db.doc('history/log').get();
      history = snap.exists ? (snap.data().entries || []) : [];
    } else {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    }
  } catch (e) {
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch (e2) { history = []; }
  }
  // Apply the real suggestion for the default category now that
  // progress data is loaded — the initial `state` literal's mode is
  // just a bootstrap placeholder, not an actual recommendation, so
  // the suggested-mode badge would otherwise be wrong the first time
  // "Practice Ahead" is opened.
  selectCategory(state.cat);
  // The due-today queue (schedule-driven: what's decaying, plus
  // today's fresh-verse batch) is the primary landing screen now —
  // category browsing above is just prepared in the background so
  // it's not stale whenever "Practice Ahead" is actually opened.
  openReview();
}
async function saveHistory() {
  try {
    if (db) {
      await db.doc('history/log').set({ entries: history });
    } else {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  } catch (e) {}
}

// Category completion: the share of its verses that have actually
// reached mastered/maintenance (the same bar the Review stats strip
// uses for its "Mastered" count), not a single best-attempt score —
// one lucky round shouldn't read as "you've got this category down".
// Untouched categories show no badge at all rather than a bare 0%.
function masteryPctFor(cat) {
  const group = DATA.find(g => g.cat === cat);
  if (!group.verses.some(v => getProgress(v.ref).stage !== 'new')) return null;
  const mastered = group.verses.filter(v => {
    const s = getProgress(v.ref).stage;
    return s === 'mastered' || s === 'maintenance';
  }).length;
  return Math.round((mastered / group.verses.length) * 100);
}
function attemptsFor(cat) {
  return history.filter(h => h.cat === cat).length;
}

// A flat list, no optgroups — mode and difficulty combined into one
// option's own visible text (e.g. "Fathom by Fathom (Hard)"), so a
// single pick sets both at once (fewer clicks than a separate
// difficulty control) while the closed select still always shows
// which mode is selected (unlike nesting difficulty under an
// optgroup, whose label vanishes once the select collapses).
function buildModeOptions() {
  const select = document.getElementById('modeSelect');
  select.innerHTML = MODES.map(m => {
    const diffs = diffsForMode(m.id);
    return diffs
      ? diffs.map(d => `<option value="${m.id}:${d.id}">${m.label} (${d.short})</option>`).join('')
      : `<option value="${m.id}">${m.label}</option>`;
  }).join('');
}

function onModeSelectChange() {
  const [modeId, diffId] = document.getElementById('modeSelect').value.split(':');
  state.mode = modeId;
  const diffs = diffsForMode(modeId);
  state.difficulty = diffs ? diffs.find(d => d.id === diffId) : null;
  document.getElementById('modeDescText').textContent = MODES.find(m => m.id === modeId).desc;
  updateSuggestedBadge();
}

function renderHome() {
  const group = DATA.find(g => g.cat === state.cat);

  document.getElementById('catHeader').innerHTML = `
    <div class="cat-header-icon">${CATEGORY_ICONS[state.cat] || ''}</div>
    <div class="cat-header-name">${state.cat}</div>
  `;

  document.getElementById('verseList').innerHTML = group.verses.map(v => {
    const stage = getProgress(v.ref).stage;
    return `
    <div class="verse-card">
      <div class="verse-card-top">
        <div class="verse-card-ref">${v.ref}</div>
        <div class="verse-card-badges">
          <div class="stage-badge stage-${stage}">${STAGE_LABELS[stage]}</div>
        </div>
      </div>
      <div class="verse-card-text">${v.text}</div>
    </div>
  `;
  }).join('');

  // Weak Link only makes sense once this category actually has tracked
  // misses to drill — disable the option entirely otherwise, rather
  // than letting someone pick a mode with nothing for it to do.
  const weakOpt = document.querySelector('#modeSelect option[value="weaklink"]');
  if (weakOpt) weakOpt.disabled = !group.verses.some(v => Object.keys(getProgress(v.ref).wordMisses).length > 0);

  // Hard mode (Safe Harbor, Dead Reckoning) mixes in a second category —
  // disable it until there's actually another category you've been
  // exposed to, same reasoning as gating Weak Link above.
  const noOtherVisited = !visitedCategories(state.cat).length;
  ['match:hard', 'reverse:hard'].forEach(val => {
    const opt = document.querySelector(`#modeSelect option[value="${val}"]`);
    if (opt) opt.disabled = noOtherVisited;
  });

  document.getElementById('modeSelect').value = state.difficulty ? `${state.mode}:${state.difficulty.id}` : state.mode;
  document.getElementById('modeDescText').textContent = MODES.find(m => m.id === state.mode).desc;
  updateSuggestedBadge();

  const catPills = document.getElementById('catPills');
  catPills.innerHTML = '';
  DATA.forEach(g => {
    const pct = masteryPctFor(g.cat);
    const div = document.createElement('div');
    div.className = 'cat-pill' + (state.cat === g.cat ? ' active' : '');
    div.innerHTML = `
      <span class="cat-pill-icon">${CATEGORY_ICONS[g.cat] || ''}</span>
      <span class="cat-pill-label">${g.cat}</span>
      ${pct === null ? '' : `<span class="cat-pill-badge">${pct}%</span>`}
    `;
    div.onclick = () => selectCategory(g.cat);
    catPills.appendChild(div);
  });

  // This is the way back to the due-today home from the secondary
  // "Practice Ahead" screen — every never-practiced verse counts as
  // "due" in SRS terms, but surfacing that as an urgent count here
  // (before any real engagement history) would just be noise.
  const reviewBtn = document.getElementById('reviewHomeBtn');
  const due = history.length ? getDueVerses(DATA).length : 0;
  reviewBtn.classList.toggle('primary', due > 0);
  reviewBtn.textContent = due > 0 ? `Back to Today (${due} Due)` : 'Back to Today';

  const streak = getStreak();
  const streakEl = document.getElementById('streakText');
  streakEl.style.display = streak > 0 ? 'inline' : 'none';
  streakEl.textContent = streak > 0 ? `${streak}-day streak` : '';

  // Content height just changed (new category, different verse
  // lengths) — recompute the fades even though no scroll happened.
  updateVerseListFades();
}

// The category's weakest verse decides what it actually needs next —
// shared by selectCategory() (to set the real default) and
// updateSuggestedBadge() (to tell whether the *current* selection,
// possibly since changed by hand, still matches that suggestion).
function suggestionForCategory(cat) {
  const group = DATA.find(g => g.cat === cat);
  const weakest = group.verses.reduce((worst, v) => {
    const s = getProgress(v.ref).stage;
    return STAGE_RANK[s] < STAGE_RANK[worst] ? s : worst;
  }, 'maintenance');
  return suggestedModeForStage(weakest);
}

function selectCategory(cat) {
  state.cat = cat;
  // Default the mode picker to whatever the category's weakest verse
  // needs next — a real default, not a lock, so it never overrides a
  // choice the user is about to make after this.
  const sug = suggestionForCategory(cat);
  state.mode = sug.mode;
  const diffs = diffsForMode(sug.mode);
  state.difficulty = diffs ? (diffs.find(d => d.id === sug.diffId) || diffs[0]) : null;
  renderHome();
}

// The suggestion engine already existed (suggestedModeForStage) but
// was invisible — the dropdown just silently pre-filled it with no
// indication a recommendation was even happening. This makes it
// visible without changing the flow: Start Quiz already runs whatever
// is selected, so no extra click is added either way.
function updateSuggestedBadge() {
  const sug = suggestionForCategory(state.cat);
  const isSuggested = state.mode === sug.mode && (state.difficulty ? state.difficulty.id : null) === sug.diffId;
  const tag = document.getElementById('suggestedTag');
  // visibility, not display -- hiding it with display:none removes
  // its space entirely, so Start Quiz/Mode/everything below it would
  // shift position depending on whether the current selection happens
  // to match the suggestion. Same reflow problem as the verse list,
  // just here it's triggered by picking a mode instead of a category.
  if (tag) tag.style.visibility = isSuggested ? 'visible' : 'hidden';
}

function startPractice() { state.isReviewSession = false; state.stepConfigs = undefined; beginSession(); }

// The due-today home: schedule-driven reinforcement (what's actually
// decaying) plus today's fresh-verse batch, merged into one queue —
// this is the primary landing screen, not a secondary "Review" you
// have to navigate to. Manually picking a category ("Practice Ahead")
// is the secondary path now.
function openReview() {
  const queue = getDueTodayQueue(DATA);
  const dueCount = getDueVerses(DATA).length;
  const newCount = getTodaysBatchCount(queue);
  let mastered = 0;
  DATA.forEach(g => g.verses.forEach(v => {
    const e = getProgress(v.ref);
    if (e.stage === 'mastered' || e.stage === 'maintenance') mastered++;
  }));
  const atRisk = queue.filter(d => (d.overdueDays ?? 0) > 3);
  document.getElementById('reviewStatsInline').innerHTML = `
    <div class="review-stat"><span>${dueCount}</span><small>Due Today</small></div>
    <div class="review-stat"><span>${newCount}</span><small>New</small></div>
    <div class="review-stat"><span>${mastered}</span><small>Mastered</small></div>
    <div class="review-stat${atRisk.length ? ' review-stat-risk' : ''}"><span>${atRisk.length}</span><small>At Risk</small></div>
  `;
  document.getElementById('reviewStartRow').innerHTML = queue.length
    ? `<button class="btn primary wide" onclick="beginReviewSession()">Start Today's Session (${queue.length})</button>`
    : `<div class="empty-hist">Nothing due, and no new verses left to introduce.</div>`;
  // At Risk verses (badly overdue) are the only ones worth calling out
  // individually — everything else in the queue is covered by the
  // single Start Session flow above, not a row-per-verse list.
  document.getElementById('dueList').innerHTML = atRisk.length ? atRisk.map((d, i) => `
    <div class="due-item" data-idx="${i}">
      <div class="due-item-main">
        <div class="due-item-ref">${d.ref}</div>
        <div class="due-item-cat">${d.cat} · ${d.overdueDays}d overdue</div>
      </div>
      <div class="stage-badge stage-${d.stage}">${STAGE_LABELS[d.stage]}</div>
    </div>
  `).join('') : '';
  document.querySelectorAll('.due-item').forEach((el, i) => {
    el.onclick = () => startReviewItem(atRisk[i]);
  });
  reviewQueue = queue;
  // Nothing to lead with today — this is where an ambient prompt gets
  // its chance, drawn only from scripture already learned or visited.
  // pickAmbientScenario() is itself once-per-day-safe, so calling it
  // here on every empty-queue visit (not just the first) is fine.
  if (!queue.length) {
    const prompt = pickAmbientScenario();
    if (prompt) { renderAmbientStage(prompt); return; }
  }
  showStage('reviewArea', queue.length ? `${queue.length} in Today's Session` : "Today's Session");
}

// getDueTodayQueue's "new" entries are today's introduced batch, not
// the full unseen pool — distinct from getNewVerses()'s total count.
function getTodaysBatchCount(queue) {
  return queue.filter(d => d.stage === 'new').length;
}

function resolveReviewItem(item) {
  const group = DATA.find(g => g.cat === item.cat);
  const v = group.verses.find(x => x.ref === item.ref);
  const diffs = diffsForMode(item.suggested.mode);
  const difficulty = diffs ? (diffs.find(d => d.id === item.suggested.diffId) || diffs[0]) : null;
  return { verse: v, mode: item.suggested.mode, difficulty, cat: item.cat };
}

// A failed cued/free attempt just recorded fresh word-misses for this
// verse (recordWordMisses runs on every failure) — jump straight into
// drilling exactly those words instead of "Play Again" replaying the
// whole mode from scratch on every verse in the session.
function drillNow(ref) {
  const group = DATA.find(g => g.verses.some(v => v.ref === ref));
  const v = group.verses.find(x => x.ref === ref);
  state.cat = group.cat;
  state.mode = 'weaklink';
  state.difficulty = null;
  state.stepConfigs = undefined;
  state.isReviewSession = false;
  beginSession([v]);
}

function startReviewItem(item) {
  const resolved = resolveReviewItem(item);
  state.cat = resolved.cat;
  state.mode = resolved.mode;
  state.difficulty = resolved.difficulty;
  state.stepConfigs = undefined;
  beginSession([resolved.verse]);
  state.isReviewSession = true;
}

let reviewQueue = [];

// Runs every due verse back to back, each in its own suggested mode,
// instead of making someone hand-pick verses one at a time from a
// list that could be hundreds of rows long.
function beginReviewSession() {
  const resolved = reviewQueue.map(resolveReviewItem);
  if (!resolved.length) return;
  state.stepConfigs = resolved.map(r => ({ mode: r.mode, difficulty: r.difficulty, cat: r.cat }));
  state.isReviewSession = true;
  beginSession(resolved.map(r => r.verse));
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function goHome() { renderHome(); showView('view-home'); cancelSession(); }

// reviewArea (the due-today queue) is home now — the one stage with
// no back button and no category/mode picker of its own.
// verseList ("Practice Ahead," manually browsing a category) and the
// three active-session UIs all have a way back to it.
const STAGES = ['verseList', 'reviewArea', 'practiceArea', 'matchArea', 'scoreArea', 'scenarioArea', 'ambientArea'];
function showStage(name, title) {
  STAGES.forEach(id => { document.getElementById(id).style.display = (id === name) ? '' : 'none'; });
  const isHome = name === 'reviewArea';
  document.getElementById('stageBack').style.display = isHome ? 'none' : 'flex';
  document.getElementById('setupArea').style.display = (name === 'verseList') ? '' : 'none';
  // The review queue spans every category, so the single-category
  // header (correct for every other stage, including review-launched
  // single-verse sessions — startReviewItem() sets state.cat to that
  // verse's real category) would be stale/misleading here specifically.
  // Situations and ambient prompts aren't scoped to one category
  // either — same reasoning.
  // A multi-verse due-today session (state.stepConfigs) spans whatever
  // mix of categories was actually due — same staleness as above,
  // just surfacing on the score screen instead of the queue itself.
  // A single-verse review (startReviewItem) doesn't set stepConfigs,
  // so its score screen keeps a real, correct single-category header.
  const crossCategoryScore = name === 'scoreArea' && (state.mode === 'scenario' || state.stepConfigs);
  const crossCategoryStage = name === 'scenarioArea' || name === 'ambientArea';
  document.getElementById('catHeader').style.display = (isHome || crossCategoryStage || crossCategoryScore) ? 'none' : '';
  if (title !== undefined) document.getElementById('stageTitle').textContent = title;

  // Live-counting timer, running only while a round is actually in
  // progress (not idle browsing, not the finished score screen, which
  // already shows the final frozen time as a stat tile).
  const isLive = name === 'practiceArea' || name === 'matchArea';
  const timerEl = document.getElementById('roundTimer');
  if (isLive) {
    startTimer(name === 'matchArea' ? matchState.startTime : state.startTime, timerEl);
  } else {
    stopTimer();
    timerEl.textContent = '';
  }
}

let timerInterval = null;
function startTimer(startTime, el) {
  stopTimer();
  const tick = () => {
    const sec = Math.floor((Date.now() - startTime) / 1000);
    el.textContent = `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}
function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function cancelSession() {
  matchState = null;
  scenarioState = null;
  state.stepConfigs = undefined;
  // 'scenario' isn't a real entry in MODES (Situations aren't
  // category-scoped, so they were never a mode-select option) —
  // renderHome() would crash looking it up there, so restore a real
  // suggestion for the current category first.
  if (state.mode === 'scenario') {
    const sug = suggestionForCategory(state.cat);
    state.mode = sug.mode;
    const diffs = diffsForMode(sug.mode);
    state.difficulty = diffs ? (diffs.find(d => d.id === sug.diffId) || diffs[0]) : null;
  }
  // Home is the due-today queue now, regardless of whether the
  // session was launched from there or from "Practice Ahead" — one
  // way back, so this doesn't need to branch on where it was entered
  // from. renderHome() still refreshes the (now-hidden) category
  // picker so it's not stale next time Practice Ahead is opened.
  renderHome();
  goHomeAfterSession();
}

// A due-today session that just finished may have queued up an
// ambient prompt (see finishSession()) — show that once instead of
// going straight home. Every other "back to today" path (a normal
// category session, Situations, or nothing pending) falls through to
// the plain openReview(), which still runs its own empty-queue
// ambient check independently.
let pendingAmbientPrompt = null;
function goHomeAfterSession() {
  if (pendingAmbientPrompt) {
    const prompt = pendingAmbientPrompt;
    pendingAmbientPrompt = null;
    renderAmbientStage(prompt);
    return;
  }
  openReview();
}

// The manual, category-by-category path — secondary to the due-today
// queue, reached only by deliberately opening it.
function practiceAhead() {
  showStage('verseList', '');
}

function modeLabel(m) {
  if (m === 'scenario') return SCENARIO_MODE_LABEL;
  return MODES.find(x => x.id === m)?.label || m;
}

// Compact title bars (round header, score screen) want just the tier
// word — the full descriptive name ("Easy — One Category") is for the
// mode-select dropdown, and stacking it after the mode name with its
// own separator reads as clutter ("Safe Harbor · Easy — One Category").
function roundTitle(mode, difficulty) {
  const label = modeLabel(mode);
  if (!difficulty) return label;
  return `${label} · ${difficulty.short || difficulty.name}`;
}

function normWord(w) {
  // Strip everything but letters/digits/apostrophes, then drop any
  // apostrophe left dangling at the start or end of the word — those
  // are stray closing/opening quote marks from nested quotations in
  // the verse text (e.g. "...to you.'\""), not real contractions.
  // A contraction's apostrophe sits between letters, so it survives.
  return (w || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
}

// Aligns typed words against the actual words via longest-common-
// subsequence, rather than comparing by raw position — a single
// dropped or extra word used to misalign every word after it, marking
// an otherwise-correct recall as wrong from that point on. Returns a
// boolean per actual word: true if it was found in the typed input in
// the correct relative order (still order-sensitive — the right words
// in the wrong order don't both get credit).
function alignWords(actualWords, typedWords) {
  const a = actualWords.map(normWord);
  const t = typedWords.map(normWord);
  const n = a.length, m = t.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === t[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === t[j]) { matched[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return matched;
}

function beginSession(verses) {
  state.lastConfig = { cat: state.cat, mode: state.mode, difficulty: state.difficulty, verses };
  const group = DATA.find(g => g.cat === state.cat);
  let sessionVerses = verses || group.verses.slice();
  if (state.mode === 'weaklink' && !verses) {
    sessionVerses = sessionVerses.filter(v => Object.keys(getProgress(v.ref).wordMisses).length > 0);
  }
  state.sessionVerses = sessionVerses;
  state.stepIndex = 0;
  state.results = [];
  state.startTime = Date.now();
  state.chunks = undefined;
  state.chunkIndex = undefined;
  state.chunkVerseRef = undefined;

  if (!state.stepConfigs && state.mode === 'match') { beginMatch(); return; }

  const title = state.stepConfigs ? "Today's Session" : roundTitle(state.mode, state.difficulty);
  showStage('practiceArea', title);
  showStep();
}

function replaySession() {
  state.cat = state.lastConfig.cat;
  state.mode = state.lastConfig.mode;
  state.difficulty = state.lastConfig.difficulty;
  beginSession(state.lastConfig.verses);
}

function showStep() {
  if (state.stepIndex >= state.sessionVerses.length) { finishSession(); return; }
  // A review session mixes verses at different stages, each needing
  // its own suggested mode/difficulty/category rather than one mode
  // for the whole session.
  if (state.stepConfigs) {
    const cfg = state.stepConfigs[state.stepIndex];
    state.mode = cfg.mode;
    state.difficulty = cfg.difficulty;
    state.cat = cfg.cat;
  }
  document.getElementById('progressLine').innerHTML = `
    <div class="chain-line">${state.sessionVerses.map((_, i) =>
      `<div class="chain-link${i <= state.stepIndex ? ' set' : ''}"></div>`).join('')}</div>
    <div>Verse ${state.stepIndex + 1} of ${state.sessionVerses.length}</div>
  `;
  document.getElementById('rateRow').style.display = 'none';
  const v = state.sessionVerses[state.stepIndex];
  if (state.mode === 'fade') renderFade(v);
  else if (state.mode === 'letters') renderLettersIntro(v);
  else if (state.mode === 'reverse') renderReverse(v);
  else if (state.mode === 'weaklink') renderWeakLink(v);
  else if (state.mode === 'chainbuild') renderChainBuild(v);
  else renderType(v);
}

function renderFade(v) {
  const words = v.text.split(' ');
  const frac = state.difficulty.frac;
  const numHidden = Math.max(1, Math.round(words.length * frac));
  let seed = 0;
  for (let i = 0; i < v.ref.length; i++) seed += v.ref.charCodeAt(i);
  let positions = words.map((_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const hiddenSet = new Set(positions.slice(0, numHidden));
  const card = document.getElementById('flashcard');
  const spans = words.map((w, i) => {
    if (hiddenSet.has(i)) {
      const widthCh = Math.max(3, w.length);
      return `<input class="blank-input" data-idx="${i}" data-answer="${w.replace(/"/g, '&quot;')}" style="width:${widthCh}ch" autocomplete="off" autocapitalize="off" spellcheck="false">`;
    }
    return `<span class="word-static">${w}</span>`;
  }).join(' ');
  card.innerHTML = `
    <div class="ref">${v.ref}</div>
    <div class="verse-text">${spans}</div>
  `;
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="checkFade()">Check</button>`;
}
function checkFade() {
  const inputs = document.querySelectorAll('.blank-input');
  if (inputs.length && inputs[0].disabled) { state.stepIndex++; showStep(); return; }
  let correct = 0;
  const missed = [];
  inputs.forEach(inp => {
    const ok = normWord(inp.value) === normWord(inp.dataset.answer);
    inp.classList.add(ok ? 'ok' : 'bad');
    if (!ok) { inp.value = inp.dataset.answer; missed.push(normWord(inp.dataset.answer)); }
    inp.disabled = true;
    if (ok) correct++;
  });
  const pct = inputs.length ? Math.round((correct / inputs.length) * 100) : 100;
  const v = state.sessionVerses[state.stepIndex];
  state.results.push({ ref: v.ref, score: pct, detail: `${correct}/${inputs.length} blanks correct`, depth: 'cued' });
  recordRecall(v.ref, pct, 'cued');
  recordWordMisses(v.ref, missed);
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="nextStep()">Next</button>`;
}

function renderWeakLink(v) {
  const words = v.text.split(' ');
  const misses = getProgress(v.ref).wordMisses;
  const hiddenSet = new Set();
  words.forEach((w, i) => { if ((misses[normWord(w)] || 0) >= 2) hiddenSet.add(i); });
  const card = document.getElementById('flashcard');
  if (!hiddenSet.size) {
    // A sibling verse in this category has weak words but this one
    // doesn't (yet) — nothing to drill, don't block the session on it.
    card.innerHTML = `
      <div class="ref">${v.ref}</div>
      <div class="verse-text">${v.text}</div>
      <div class="tap-hint">No tracked misses for this verse yet. Nothing to drill.</div>
    `;
    document.getElementById('rateRow').style.display = 'flex';
    document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="nextStep()">Next</button>`;
    return;
  }
  const spans = words.map((w, i) => {
    if (hiddenSet.has(i)) {
      const widthCh = Math.max(3, w.length);
      return `<input class="blank-input" data-idx="${i}" data-answer="${w.replace(/"/g, '&quot;')}" style="width:${widthCh}ch" autocomplete="off" autocapitalize="off" spellcheck="false">`;
    }
    return `<span class="word-static">${w}</span>`;
  }).join(' ');
  card.innerHTML = `
    <div class="ref">${v.ref}</div>
    <div class="verse-text">${spans}</div>
  `;
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="checkWeakLink()">Check</button>`;
}
function checkWeakLink() {
  const inputs = document.querySelectorAll('.blank-input');
  if (inputs.length && inputs[0].disabled) { state.stepIndex++; showStep(); return; }
  const v = state.sessionVerses[state.stepIndex];
  let correct = 0;
  inputs.forEach(inp => {
    const ok = normWord(inp.value) === normWord(inp.dataset.answer);
    inp.classList.add(ok ? 'ok' : 'bad');
    const answerWord = normWord(inp.dataset.answer);
    if (!ok) { inp.value = inp.dataset.answer; recordWordMisses(v.ref, [answerWord]); }
    else resolveWordMiss(v.ref, answerWord);
    inp.disabled = true;
    if (ok) correct++;
  });
  const pct = inputs.length ? Math.round((correct / inputs.length) * 100) : 100;
  state.results.push({ ref: v.ref, score: pct, detail: `${correct}/${inputs.length} weak words fixed`, depth: 'cued' });
  recordRecall(v.ref, pct, 'cued');
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="nextStep()">Next</button>`;
}

// First-letter cue for a stretch of text — every `every`th word shows
// its initial, the rest a blank placeholder. Shared by Chain of
// Initials (cueing the whole verse before one big recall) and Anchor
// Chain Build (cueing just the next uncalled phrase, so the boundary
// and shape of "the next bit to produce" is never a blind guess).
function initialsCue(text, every) {
  return text.split(' ').map((w, i) => {
    if (i % every !== 0) return '▁';
    const m = w.match(/[A-Za-z]/);
    return m ? m[0] : w[0];
  }).join(' ');
}

function renderLettersIntro(v) {
  const initials = initialsCue(v.text, state.difficulty.every);
  const card = document.getElementById('flashcard');
  card.innerHTML = `
    <div class="ref">${v.ref}</div>
    <div class="letters-line">${initials}</div>
    <div class="tap-hint">Recite it from these cues, then type it below</div>
  `;
  document.getElementById('rateRow').style.display = 'none';
  setTimeout(() => renderTypeArea(v, true), 50);
}
function renderType(v) {
  renderTypeArea(v, false);
}
function renderTypeArea(v, afterLetters) {
  const card = document.getElementById('flashcard');
  if (!afterLetters) {
    card.innerHTML = `
      <div class="ref">${v.ref}</div>
      <textarea id="typeInput" placeholder="Type the verse from memory..." autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
      <div id="typeResult"></div>
    `;
  } else {
    card.insertAdjacentHTML('beforeend', `
      <textarea id="typeInput" placeholder="Type the full verse..." style="margin-top:14px;" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
      <div id="typeResult"></div>
    `);
  }
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="checkType()">Check</button>`;
}
// Shared by every bare-textarea free-recall check (By Heart, Chain
// Build's final link, Situations' By Heart tier) — grades typed text
// against a target string via the same word-diff engine.
function gradeFreeRecall(actualText, typedText) {
  const typed = typedText.trim().split(/\s+/).filter(Boolean);
  const actual = actualText.split(' ');
  const matched = alignWords(actual, typed);
  let correctCount = 0;
  const missed = [];
  const diffHtml = actual.map((w, i) => {
    if (matched[i]) { correctCount++; return `<span class="ok">${w}</span>`; }
    missed.push(normWord(w));
    return `<span class="miss">${w}</span>`;
  }).join(' ');
  // Denominator counts extra typed words too, not just the target
  // text's word count — otherwise an inserted word that doesn't
  // displace any real word goes completely unpenalized, since every
  // actual word can still be found in order in the LCS alignment.
  const pct = Math.round((correctCount / Math.max(actual.length, typed.length)) * 100);
  return { pct, diffHtml, missed, correctCount, actualLen: actual.length };
}

function checkType() {
  const btn = document.getElementById('rateRow');
  if (btn.dataset.checked === '1') { state.stepIndex++; showStep(); return; }
  const v = state.sessionVerses[state.stepIndex];
  const { pct, diffHtml, missed, correctCount, actualLen } = gradeFreeRecall(v.text, document.getElementById('typeInput').value);
  document.getElementById('typeResult').innerHTML = `
    <div class="score-line">${pct}% word match</div>
    <div class="diff-line">${diffHtml}</div>
  `;
  state.results.push({ ref: v.ref, score: pct, detail: `${correctCount}/${actualLen} words correct`, depth: 'free' });
  recordRecall(v.ref, pct, 'free');
  recordWordMisses(v.ref, missed);
  btn.dataset.checked = '1';
  btn.innerHTML = `<button class="action-btn" onclick="nextStep()">Next</button>`;
}

function renderChainBuild(v) {
  if (state.chunkVerseRef !== v.ref) {
    state.chunks = chunkVerse(v.text);
    state.chunkIndex = 0;
    state.chunkVerseRef = v.ref;
  }
  const settled = state.chunks.slice(0, state.chunkIndex).join(' ');
  const nextPhrase = state.chunks[state.chunkIndex];
  const card = document.getElementById('flashcard');
  card.innerHTML = `
    <div class="theme-tag">Link ${state.chunkIndex + 1} of ${state.chunks.length}</div>
    <div class="ref">${v.ref}</div>
    ${settled ? `<div class="verse-text chain-settled">${settled}</div>` : ''}
    <div class="letters-line">${initialsCue(nextPhrase, 1)}</div>
    <div class="tap-hint">${settled ? 'Type everything so far, including the new phrase:' : 'Type the first phrase:'}</div>
    <textarea id="typeInput" placeholder="Type it..." autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
    <div id="typeResult"></div>
  `;
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="checkChainBuild()">Check</button>`;
}
function checkChainBuild() {
  const btn = document.getElementById('rateRow');
  if (btn.dataset.checked === '1') {
    btn.dataset.checked = '';
    state.chunkIndex++;
    if (state.chunkIndex >= state.chunks.length) {
      state.chunks = undefined; state.chunkIndex = undefined; state.chunkVerseRef = undefined;
      state.stepIndex++;
    }
    showStep();
    return;
  }
  const v = state.sessionVerses[state.stepIndex];
  const targetText = state.chunks.slice(0, state.chunkIndex + 1).join(' ');
  const { pct, diffHtml, missed, correctCount, actualLen } = gradeFreeRecall(targetText, document.getElementById('typeInput').value);
  document.getElementById('typeResult').innerHTML = `
    <div class="score-line">${pct}% word match</div>
    <div class="diff-line">${diffHtml}</div>
  `;
  const isLastLink = state.chunkIndex === state.chunks.length - 1;
  if (isLastLink) {
    // The final link is the whole verse, recalled cumulatively from a
    // bare textarea — a real free-recall event, same standing as By
    // Heart for spaced-repetition purposes.
    state.results.push({ ref: v.ref, score: pct, detail: `${correctCount}/${actualLen} words correct (full verse)`, depth: 'free' });
    recordRecall(v.ref, pct, 'free');
    recordWordMisses(v.ref, missed);
  }
  btn.dataset.checked = '1';
  btn.innerHTML = `<button class="action-btn" onclick="checkChainBuild()">${isLastLink ? 'Next' : 'Next Link'}</button>`;
}

function nextStep() {
  const row = document.getElementById('rateRow');
  row.dataset.checked = '';
  state.stepIndex++;
  showStep();
}

// Score tiers by how many tries it took to land on the correct
// answer — 1st try is a clean recognition, each wrong guess before it
// is a partial miss, not a hard fail. The color on the eventual
// correct pick always matches this same tier, so the visual and the
// score never disagree. Shared by every multiple-choice/matching mode
// (Dead Reckoning, Safe Harbor) — typed recall modes grade in one
// shot instead, since letting a blank be retried until correct would
// be guess-and-check, not recollection.
const ATTEMPT_TIERS = [
  { max: 1, score: 100, cls: 'tier-1' },
  { max: 2, score: 66, cls: 'tier-2' },
  { max: 3, score: 33, cls: 'tier-3' },
  { max: Infinity, score: 0, cls: 'tier-4' }
];
let reverseWrongCount = 0;

// Hard mode mixes in a second category to test distinguishing similar
// references across categories — that only works as a real test
// against a category you've actually been exposed to. A category
// counts as visited once at least one of its verses has moved past
// 'new' (i.e. you've recognized or recalled it at least once); a
// completely untouched category would just be blind guessing, not a
// harder version of the same test.
function visitedCategories(excludeCat) {
  return DATA.filter(g => g.cat !== excludeCat && g.verses.some(v => getProgress(v.ref).stage !== 'new'));
}

function renderReverse(v) {
  // Distractor pool: the rest of the current category always; on Hard,
  // also pull in one other *visited* category for a wider, tougher
  // pool — same pattern as Safe Harbor's difficulty split.
  const group = DATA.find(g => g.cat === state.cat);
  let pool = group.verses.filter(x => x.ref !== v.ref).map(x => x.ref);
  const others = state.difficulty.id === 'hard' ? visitedCategories(state.cat) : [];
  if (others.length) {
    const other = others[Math.floor(Math.random() * others.length)];
    pool = pool.concat(other.verses.map(x => x.ref));
  }
  pool = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [v.ref, ...pool].sort(() => Math.random() - 0.5);

  reverseWrongCount = 0;
  const card = document.getElementById('flashcard');
  card.innerHTML = `
    <div class="verse-text">${v.text}</div>
    <div class="ref-options" id="refOptions">
      ${options.map(r => `<button class="ref-option" data-ref="${r.replace(/"/g, '&quot;')}">${r}</button>`).join('')}
    </div>
  `;
  document.querySelectorAll('.ref-option').forEach(btn => {
    btn.onclick = () => checkReverse(btn, v.ref);
  });
  document.getElementById('rateRow').style.display = 'none';
}
function checkReverse(btn, correctRef) {
  if (btn.disabled) return;
  if (btn.dataset.ref !== correctRef) {
    // Wrong guesses don't end the round — keep guessing until the
    // correct reference is found, same as the map-quiz pattern this
    // is modeled on. Each miss is just disabled + marked so it can't
    // be re-picked.
    reverseWrongCount++;
    btn.disabled = true;
    btn.classList.add('bad');
    return;
  }
  const tier = ATTEMPT_TIERS.find(t => reverseWrongCount + 1 <= t.max);
  document.querySelectorAll('.ref-option').forEach(o => { o.disabled = true; });
  btn.classList.add(tier.cls);
  recordRecognition(correctRef);
  const detail = tier.score === 100 ? 'Picked the right reference' : `Picked the right reference after ${reverseWrongCount + 1} tries`;
  state.results.push({ ref: correctRef, score: tier.score, detail, depth: 'recognition' });
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="nextStep()">Next</button>`;
}

function beginMatch() {
  const group = DATA.find(g => g.cat === state.cat);
  let pairSource = group.verses.map(v => ({ ref: v.ref, text: v.text, cat: state.cat }));
  let snippetLen = 999;
  if (state.difficulty.id === 'hard') {
    const others = visitedCategories(state.cat);
    if (others.length) {
      const other = others[Math.floor(Math.random() * others.length)];
      pairSource = pairSource.concat(other.verses.map(v => ({ ref: v.ref, text: v.text, cat: other.cat })));
      snippetLen = 6;
    }
  }
  const snippetOf = (text) => {
    const words = text.split(' ');
    return words.length <= snippetLen ? text : words.slice(0, snippetLen).join(' ') + '…';
  };
  const refs = pairSource.map(p => ({ ref: p.ref })).sort(() => Math.random() - 0.5);
  const texts = pairSource.map(p => ({ ref: p.ref, snippet: snippetOf(p.text) })).sort(() => Math.random() - 0.5);

  matchState = { pairSource, refs, texts, matchedCount: 0, total: pairSource.length, mistakes: 0, attempts: {}, selectedRef: null, startTime: Date.now() };

  renderMatch();
  showStage('matchArea', roundTitle(state.mode, state.difficulty));
}

function renderMatch() {
  document.getElementById('matchStats').textContent = `${matchState.matchedCount}/${matchState.total} paired · ${matchState.mistakes} miss${matchState.mistakes === 1 ? '' : 'es'}`;
  const refCol = document.getElementById('matchRefCol');
  const textCol = document.getElementById('matchTextCol');
  refCol.innerHTML = '';
  textCol.innerHTML = '';
  // A matched pair is colored by how many wrong texts were tried
  // against its reference before the match landed — same tiering as
  // Dead Reckoning, so a clean first-try match reads green and a
  // pair that took several misses reads progressively hotter.
  matchState.refs.forEach(r => {
    const div = document.createElement('div');
    div.className = 'match-chip';
    div.textContent = r.ref;
    div.dataset.ref = r.ref;
    if (r.matched) div.classList.add('matched', tierFor(matchState.attempts[r.ref]).cls);
    if (matchState.selectedRef === r.ref && !r.matched) div.classList.add('selected');
    if (!r.matched) div.onclick = () => selectRef(r.ref);
    refCol.appendChild(div);
  });
  matchState.texts.forEach(t => {
    const div = document.createElement('div');
    div.className = 'match-chip';
    div.textContent = t.snippet;
    div.dataset.ref = t.ref;
    if (t.matched) div.classList.add('matched', tierFor(matchState.attempts[t.ref]).cls);
    if (!t.matched) div.onclick = () => selectText(t.ref);
    textCol.appendChild(div);
  });
}
function tierFor(wrongCount) {
  return ATTEMPT_TIERS.find(t => (wrongCount || 0) + 1 <= t.max);
}
function selectRef(ref) {
  // Re-clicking the already-selected ref used to toggle it off with no
  // visual cue — an easy accidental double-click that silently
  // deselects it, so the next click on its correct text does nothing
  // and the round looks stuck. Selecting is idempotent instead: only
  // clicking a *different* ref changes the selection.
  matchState.selectedRef = ref;
  renderMatch();
}
function selectText(ref) {
  if (!matchState.selectedRef) return;
  const chosenRef = matchState.selectedRef;
  if (chosenRef === ref) {
    matchState.refs.find(r => r.ref === chosenRef).matched = true;
    matchState.texts.find(t => t.ref === ref).matched = true;
    matchState.matchedCount++;
    matchState.selectedRef = null;
    renderMatch();
    if (matchState.matchedCount === matchState.total) finishMatch();
  } else {
    matchState.mistakes++;
    matchState.attempts[chosenRef] = (matchState.attempts[chosenRef] || 0) + 1;
    matchState.selectedRef = null;
    renderMatch();
  }
}
function finishMatch() {
  const timeSec = Math.round((Date.now() - matchState.startTime) / 1000);
  const score = Math.round((matchState.total / (matchState.total + matchState.mistakes)) * 100);
  // Every pair in the game ends up correctly matched by the time this
  // fires (that's the win condition) — each one counts as a
  // recognition success, regardless of how many wrong guesses it took
  // along the way.
  matchState.pairSource.forEach(p => recordRecognition(p.ref));
  logAttempt(state.cat, 'match', state.difficulty.name, score, timeSec);
  recordActivity();
  showScoreScreen(score, timeSec, [], [
    { label: 'Pairs', value: matchState.total },
    { label: 'Misses', value: matchState.mistakes }
  ]);
}

// Ambient prompts draw only from the learned-or-visited pool, unlike
// Situations' own Preview/Match which are unrestricted — lives here
// rather than progress.js since it needs SCENARIOS (scenarios.js)
// alongside progress state, and neither of those modules imports the
// other. Returns null when nothing's eligible yet or today's prompt
// has already been shown.
function pickAmbientScenario() {
  if (ambientAlreadyShownToday()) return null;

  const eligible = SCENARIOS
    .map(s => ({ situation: s, connections: s.connections.filter(c => isLearnedOrVisited(c.ref)) }))
    .filter(s => s.connections.length > 0);
  if (!eligible.length) return null;

  const lastSituation = getLastAmbientSituation();
  const preferred = eligible.filter(s => s.situation.situation !== lastSituation);
  const pool = preferred.length ? preferred : eligible;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const connection = picked.connections[Math.floor(Math.random() * picked.connections.length)];

  recordAmbientShown(picked.situation.situation);
  return { situation: picked.situation, connection };
}

// Tap-to-reveal only — no scoring, no recordRecall/recordRecognition.
// This is reinforcement for scripture already learned or visited, not
// another test of it; keeping it inert is what keeps the SM-2
// schedule's retention signal free of scenario context.
let ambientPrompt = null;
function renderAmbientStage(prompt) {
  ambientPrompt = prompt;
  document.getElementById('ambientBody').innerHTML = `
    <div class="scenario-card">
      <div class="scenario-situation">${prompt.situation.situation}</div>
      <div id="ambientReveal"></div>
    </div>
    <div class="rate-row" id="ambientRateRow"><button class="action-btn" onclick="revealAmbient()">Reveal</button></div>
  `;
  showStage('ambientArea', 'Worth Remembering');
}
function revealAmbient() {
  const btn = document.getElementById('ambientRateRow');
  if (btn.dataset.revealed === '1') {
    ambientPrompt = null;
    openReview();
    return;
  }
  const c = ambientPrompt.connection;
  document.getElementById('ambientReveal').innerHTML = `
    <div class="scenario-connection">
      <div class="scenario-ref">${c.ref}</div>
      <div class="scenario-scene">${c.scene}</div>
      <div class="scenario-why">${c.whyAnalogical}</div>
    </div>
  `;
  btn.dataset.revealed = '1';
  btn.innerHTML = `<button class="action-btn" onclick="revealAmbient()">Continue</button>`;
}

// Situations aren't scoped to one category (a situation's connection
// can point anywhere in the verse bank), so this is a separate entry
// point rather than another item in the category-picker's mode
// select — see suggestScenarioTier()/showStage's isHome handling.
let scenarioState = null;
function beginScenario() {
  scenarioState = { tier: 'preview', match: null };
  renderScenarioTabs();
  renderScenarioTier();
  showStage('scenarioArea', 'Situations');
}
function renderScenarioTabs() {
  const matchLocked = SCENARIOS.length < SCENARIO_MATCH_MIN;
  document.getElementById('scenarioTabs').innerHTML = SCENARIO_DIFFS.map(d => {
    const disabled = d.id === 'match' && matchLocked;
    return `<button class="scenario-tab${scenarioState.tier === d.id ? ' active' : ''}"${disabled ? ' disabled title="Add a few more situations to unlock Match"' : ` onclick="switchScenarioTier('${d.id}')"`}>${d.short}</button>`;
  }).join('');
}
function switchScenarioTier(tier) {
  scenarioState.tier = tier;
  scenarioState.match = null;
  renderScenarioTabs();
  renderScenarioTier();
}
function renderScenarioTier() {
  if (scenarioState.tier === 'preview') renderScenarioPreview();
  else renderScenarioMatch();
}

// Pure exposure — every situation, its connection(s), the scene, and
// why the connection is analogical rather than literal, all at once.
// No grading, nothing recorded. The "see the whole labeled map first"
// step, same reasoning as any preview-before-quiz pattern.
function renderScenarioPreview() {
  document.getElementById('scenarioBody').innerHTML = SCENARIOS.map(s => `
    <div class="scenario-card">
      <div class="scenario-situation">${s.situation}</div>
      ${s.connections.map(c => `
        <div class="scenario-connection">
          <div class="scenario-ref">${c.ref}</div>
          <div class="scenario-scene">${c.scene}</div>
          <div class="scenario-why">${c.whyAnalogical}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderScenarioMatch() {
  const body = document.getElementById('scenarioBody');
  if (SCENARIOS.length < SCENARIO_MATCH_MIN) {
    body.innerHTML = `<div class="empty-hist">Add a few more situations to unlock Match — needs at least ${SCENARIO_MATCH_MIN}, there ${SCENARIOS.length === 1 ? 'is' : 'are'} currently ${SCENARIOS.length}.</div>`;
    return;
  }
  if (!scenarioState.match) {
    const situations = SCENARIOS.map((s, i) => ({
      idx: i,
      snippet: s.situation.length > 140 ? s.situation.slice(0, 140) + '…' : s.situation
    })).sort(() => Math.random() - 0.5);
    // One tile per situation, using its first connection as the match
    // target — a situation with more than one valid connection still
    // counts a tap correct against any of them (see selectScenarioRef).
    const refs = SCENARIOS.map((s, i) => ({ idx: i, ref: s.connections[0].ref })).sort(() => Math.random() - 0.5);
    scenarioState.match = { situations, refs, matchedCount: 0, total: SCENARIOS.length, mistakes: 0, attempts: {}, selectedIdx: null, startTime: Date.now() };
  }
  const m = scenarioState.match;
  body.innerHTML = `
    <div class="match-stats">${m.matchedCount}/${m.total} paired · ${m.mistakes} miss${m.mistakes === 1 ? '' : 'es'}</div>
    <div class="match-grid">
      <div class="match-col" id="scenarioSituationCol"></div>
      <div class="match-col" id="scenarioRefCol"></div>
    </div>
  `;
  const sitCol = document.getElementById('scenarioSituationCol');
  const refCol = document.getElementById('scenarioRefCol');
  m.situations.forEach(s => {
    const div = document.createElement('div');
    div.className = 'match-chip';
    div.textContent = s.snippet;
    if (s.matched) div.classList.add('matched', tierFor(m.attempts[s.idx]).cls);
    if (m.selectedIdx === s.idx && !s.matched) div.classList.add('selected');
    if (!s.matched) div.onclick = () => selectScenarioSituation(s.idx);
    sitCol.appendChild(div);
  });
  m.refs.forEach(r => {
    const div = document.createElement('div');
    div.className = 'match-chip';
    div.textContent = r.ref;
    if (r.matched) div.classList.add('matched', tierFor(m.attempts[r.idx]).cls);
    // After the 3rd wrong guess on a situation, blink its correct
    // pairing rather than leaving someone stuck guessing forever —
    // a fresh element each render, so the animation replays on every
    // subsequent miss too, not just the one that crossed the threshold.
    else if ((m.attempts[r.idx] || 0) >= 3) div.classList.add('hint-blink');
    if (!r.matched) div.onclick = () => selectScenarioRef(r.idx, r.ref);
    refCol.appendChild(div);
  });
}
function selectScenarioSituation(idx) {
  scenarioState.match.selectedIdx = idx;
  renderScenarioMatch();
}
function selectScenarioRef(refIdx, ref) {
  const m = scenarioState.match;
  if (m.selectedIdx == null) return;
  const chosenIdx = m.selectedIdx;
  // Correct against ANY of the selected situation's connections, not
  // just its first — a situation can have more than one valid
  // scriptural resonance.
  const isCorrect = SCENARIOS[chosenIdx].connections.some(c => c.ref === ref);
  if (isCorrect) {
    m.situations.find(s => s.idx === chosenIdx).matched = true;
    m.refs.find(r => r.idx === refIdx).matched = true;
    m.matchedCount++;
    m.selectedIdx = null;
    renderScenarioMatch();
    if (m.matchedCount === m.total) finishScenarioMatch();
  } else {
    m.mistakes++;
    m.attempts[chosenIdx] = (m.attempts[chosenIdx] || 0) + 1;
    m.selectedIdx = null;
    renderScenarioMatch();
  }
}
function finishScenarioMatch() {
  const m = scenarioState.match;
  const timeSec = Math.round((Date.now() - m.startTime) / 1000);
  const score = Math.round((m.total / (m.total + m.mistakes)) * 100);
  // Matching is recognition, not recall — same standing as Safe
  // Harbor's finishMatch(), never touches the SM-2 schedule. Completing
  // this round is also exactly what "played a scenario as a quiz"
  // means — mark each drilled verse visited so it enters the pool
  // ambient prompts draw from.
  SCENARIOS.forEach(s => {
    recordRecognition(s.connections[0].ref);
    markScenarioVisited(s.connections[0].ref);
  });
  logAttempt('Situations', 'scenario', SCENARIO_DIFFS[1].name, score, timeSec);
  recordActivity();
  scenarioState.match = null;
  // showScoreScreen keys its title/leaderboard off state.mode — flag
  // this as a scenario finish so it doesn't show a stale category's
  // leaderboard. cancelSession() resets this back to something valid
  // for the mode-select dropdown once the user navigates away.
  state.mode = 'scenario'; state.difficulty = null; state.stepConfigs = undefined; state.isReviewSession = false;
  showScoreScreen(score, timeSec, [], [
    { label: 'Pairs', value: m.total },
    { label: 'Misses', value: m.mistakes }
  ]);
}

function finishSession() {
  const timeSec = Math.round((Date.now() - state.startTime) / 1000);
  const avg = Math.round(state.results.reduce((s, r) => s + r.score, 0) / state.results.length);
  // A review session spans multiple categories and modes, so it
  // doesn't fit the per-cat/mode leaderboard schema — only log
  // straight single-mode practice sessions.
  if (!state.stepConfigs) logAttempt(state.cat, state.mode, state.difficulty ? state.difficulty.name : '', avg, timeSec);
  recordActivity();
  // Only a due-today session (not a normal category practice run)
  // gets a chance at an ambient prompt afterward — picked now, shown
  // once the user actually leaves the score screen (see
  // goHomeAfterSession()), never mixed into the session itself.
  if (state.isReviewSession) pendingAmbientPrompt = pickAmbientScenario();
  showScoreScreen(avg, timeSec, state.results, [{ label: 'Verses', value: state.results.length }]);
  state.stepConfigs = undefined;
}

function logAttempt(cat, mode, difficulty, score, timeSec) {
  history.unshift({ ts: new Date().toISOString(), cat, mode: modeLabel(mode), difficulty, score, timeSec });
  saveHistory();
}

function showScoreScreen(score, timeSec, results, extraStats) {
  document.getElementById('scoreBig').textContent = score + '%';
  const mins = Math.floor(timeSec / 60), secs = timeSec % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const stats = [{ label: 'Time', value: timeStr }, ...(extraStats || [])];
  document.getElementById('scoreStats').innerHTML = stats.map(s => `
    <div class="score-stat"><span>${s.value}</span><small>${s.label}</small></div>
  `).join('');
  const reviewList = document.getElementById('reviewList');
  const reviewBtn = document.getElementById('reviewBtn');
  if (results && results.length) {
    reviewBtn.style.display = 'block';
    reviewList.style.display = 'none';
    // Recognition-mode results (Dead Reckoning) have no mastery-stage
    // threshold to be judged against — only recall-depth results
    // (cued/free) get a pass/fail verdict, since PASS_THRESHOLD is
    // what recordRecall actually gates stage advancement on.
    reviewList.innerHTML = results.map(r => {
      const graded = r.depth && r.depth !== 'recognition';
      const pass = graded && r.score >= PASS_THRESHOLD;
      const verdictClass = graded ? (pass ? ' pass' : ' fail') : '';
      const verdictLabel = graded ? `<span class="review-verdict">${pass ? 'Locked in' : 'Not yet'}</span>` : '';
      const drillBtn = graded && !pass ? `<button class="review-drill-btn" data-ref="${r.ref.replace(/"/g, '&quot;')}">Drill these words</button>` : '';
      return `
      <div class="review-item${verdictClass}">
        <div class="review-ref">${r.ref}<span class="review-pct">${r.score}%</span></div>
        <div class="review-detail">${r.detail}</div>
        ${verdictLabel}
        ${drillBtn}
      </div>
    `;
    }).join('');
    reviewList.querySelectorAll('.review-drill-btn').forEach(btn => {
      btn.onclick = () => drillNow(btn.dataset.ref);
    });
  } else {
    reviewBtn.style.display = 'none';
    reviewList.style.display = 'none';
  }
  const scoreHistory = document.getElementById('scoreHistoryBody');
  const scoreHistoryLabel = scoreHistory.previousElementSibling;
  // Situations aren't scoped to one category/mode/difficulty either
  // (and never touch state.cat/mode/difficulty at all), so they need
  // the same "no single leaderboard applies" treatment a mixed-mode
  // review session gets.
  const crossCategory = state.stepConfigs || state.mode === 'scenario';
  if (crossCategory) {
    scoreHistory.innerHTML = '';
    if (scoreHistoryLabel) scoreHistoryLabel.style.display = 'none';
  } else {
    if (scoreHistoryLabel) scoreHistoryLabel.style.display = '';
    scoreHistory.innerHTML = leaderboardMarkup(5, state.cat, modeLabel(state.mode), state.difficulty ? state.difficulty.name : '');
  }
  document.getElementById('nextDueBtn').style.display = state.isReviewSession ? 'block' : 'none';
  // A flowing review session's queue isn't a single cat/mode/difficulty
  // config replaySession() can reconstruct — "Next Due Verse" is
  // already the sensible restart action here. Same for Situations —
  // replaySession() would just re-run whatever category session ran
  // before this, which isn't what "Play Again" should mean here.
  document.getElementById('playAgainBtn').style.display = crossCategory ? 'none' : 'block';
  // "Review" would collide with the Review button just below (the
  // per-verse pass/fail breakdown toggle) — different things, same
  // word, so this uses the same "Today's Session" label the queue
  // and the live session screen already use.
  const title = state.stepConfigs ? "Today's Session" : state.mode === 'scenario' ? 'Situations' : roundTitle(state.mode, state.difficulty);
  showStage('scoreArea', title);
}
function toggleReview() {
  const el = document.getElementById('reviewList');
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

// The score screen's "High Score" preview: entries for the exact
// category + mode just played, ranked by best score first (fastest
// time as tiebreaker) so row one is literally the record to beat.
function leaderboardMarkup(limit, cat, mode, difficulty) {
  // Scoped to the exact cat + mode + difficulty just played — every
  // row is already that one difficulty, so a dedicated column would
  // just repeat the same value down the whole table.
  const entries = history.filter(h => h.cat === cat && h.mode === mode && h.difficulty === difficulty)
    .slice().sort((a, b) => b.score - a.score || a.timeSec - b.timeSec);
  if (!entries.length) {
    return `<div class="empty-hist">No attempts logged yet. Run a category and it'll show up here.</div>`;
  }
  return entries.slice(0, limit).map((h, i) => {
    const time = `${Math.floor(h.timeSec / 60)}:${(h.timeSec % 60).toString().padStart(2, '0')}`;
    return `
    <div class="lb-row${i === 0 ? ' hi-score-row' : ''}">
      <span class="lb-score">${h.score}%</span>
      <span class="lb-time">${time}</span>
    </div>
  `;
  }).join('');
}

// Pairs each category with the plain name of its icon (see icons.js
// for the shapes themselves) and the bit of symbolism behind it, for
// the About page's icon grid. Kept here rather than in icons.js since
// it's prose for a reader, not part of the icon-drawing logic.
const ICON_MEANINGS = {
  "Who God Is": { icon: 'Compass', meaning: "a fixed reference point, unmoved by whatever's happening around it" },
  "Our Unrighteousness": { icon: 'Storm cloud', meaning: 'the weight and fallout of sin' },
  "God's Mercy": { icon: 'Lighthouse', meaning: 'the light held out to something wrecked' },
  "God's Power": { icon: 'Lightning', meaning: '' },
  "Healing": { icon: 'Pulse line', meaning: 'restoration to life, not just relief' },
  "Power of Prayer": { icon: "Ship's wheel", meaning: 'hands actually on the helm' },
  "Power of Faith": { icon: 'Sail', meaning: 'substance made visible only by what it moves' },
  "Renewal of the Mind": { icon: 'Sunrise', meaning: '' },
  "Bearing One Another Up": { icon: 'Braced crossbar', meaning: "support, not rescue — someone else's job is holding you steady, not fighting your battle for you" },
  "Your Own Calling": { icon: 'Heading arrow', meaning: "your own next step, not a comparison to someone else's path" },
  "Being Seen": { icon: 'Open eye', meaning: 'seen by God even in the place you feel most overlooked' },
  "God's Provision": { icon: 'Jar', meaning: 'enough for today, again tomorrow — not a lump sum up front' },
  "Forgiveness": { icon: 'Released hands', meaning: "holding both a real wrong and a refusal to let it be the last word" }
};

function renderIconGrid() {
  const grid = document.getElementById('iconGrid');
  if (!grid) return;
  grid.innerHTML = DATA.map(g => {
    const info = ICON_MEANINGS[g.cat] || { icon: '', meaning: '' };
    return `
      <div class="icon-chip">
        <div class="icon-chip-glyph">${CATEGORY_ICONS[g.cat] || ''}</div>
        <div class="icon-chip-text">
          <span class="icon-chip-name">${info.icon}</span>
          <span class="icon-chip-cat">${g.cat}${info.meaning ? ': ' + info.meaning : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

function openAbout() { renderIconGrid(); showView('view-about'); }

// The markup uses inline onclick="" handlers (kept as-is from the
// original single-file version — rewiring to addEventListener isn't
// needed for this app's size and would just be churn). Since this
// file is loaded as an ES module, its top-level functions are NOT
// implicitly global, so the ones referenced from index.html's
// onclick attributes must be attached to window explicitly.
Object.assign(window, {
  goHome, showView, replaySession, toggleReview,
  checkFade, nextStep, checkType, startPractice, cancelSession, openReview,
  checkWeakLink, checkChainBuild, openAbout, beginReviewSession, practiceAhead,
  beginScenario, switchScenarioTier, revealAmbient, goHomeAfterSession
});

Promise.all([loadProgress(), loadStreak(), loadNewCardState(), loadAmbientState()]).then(loadHistory);
