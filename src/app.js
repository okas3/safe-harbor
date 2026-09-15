import './style.css';
import { DATA } from './verses.js';
import { FADE_DIFFS, LETTER_DIFFS, MATCH_DIFFS, REVERSE_DIFFS } from './difficulties.js';
import { CATEGORY_ICONS, ANCHOR_ICON } from './icons.js';
import { loadProgress, recordRecognition, recordRecall, recordWordMisses, resolveWordMiss, getProgress, getDueVerses, suggestedModeForStage } from './progress.js';
import { chunkVerse } from './chunking.js';

document.getElementById('h1IconLeft').innerHTML = ANCHOR_ICON;
document.getElementById('h1IconRight').innerHTML = ANCHOR_ICON;

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
  renderHome();
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

function bestScoreFor(cat) {
  const entries = history.filter(h => h.cat === cat);
  if (!entries.length) return null;
  return Math.max(...entries.map(h => h.score));
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

  const catPills = document.getElementById('catPills');
  catPills.innerHTML = '';
  DATA.forEach(g => {
    const best = bestScoreFor(g.cat);
    const div = document.createElement('div');
    div.className = 'cat-pill' + (state.cat === g.cat ? ' active' : '');
    div.innerHTML = `
      <span class="cat-pill-icon">${CATEGORY_ICONS[g.cat] || ''}</span>
      <span class="cat-pill-label">${g.cat}</span>
      ${best === null ? '' : `<span class="cat-pill-badge">${best}%</span>`}
    `;
    div.onclick = () => selectCategory(g.cat);
    catPills.appendChild(div);
  });
}

function selectCategory(cat) {
  state.cat = cat;
  // Default the mode picker to whatever the category's weakest verse
  // needs next — a real default, not a lock, so it never overrides a
  // choice the user is about to make after this.
  const group = DATA.find(g => g.cat === cat);
  const weakest = group.verses.reduce((worst, v) => {
    const s = getProgress(v.ref).stage;
    return STAGE_RANK[s] < STAGE_RANK[worst] ? s : worst;
  }, 'maintenance');
  const sug = suggestedModeForStage(weakest);
  state.mode = sug.mode;
  const diffs = diffsForMode(sug.mode);
  state.difficulty = diffs ? (diffs.find(d => d.id === sug.diffId) || diffs[0]) : null;
  renderHome();
}

function startPractice() { state.isReviewSession = false; state.stepConfigs = undefined; beginSession(); }

// Retention-health strip: what's actually due, what's holding, what's
// slipping — shown when you actually open Review, not leading the
// home screen (a fresh account with zero practice history would
// otherwise open to a meaningless "28 Due Today" before you've done
// anything at all).
function openReview() {
  const due = getDueVerses(DATA);
  let mastered = 0;
  DATA.forEach(g => g.verses.forEach(v => {
    const e = getProgress(v.ref);
    if (e.stage === 'mastered' || e.stage === 'maintenance') mastered++;
  }));
  const atRisk = due.filter(d => (d.overdueDays ?? 0) > 3);
  document.getElementById('reviewStatsInline').innerHTML = `
    <div class="review-stat"><span>${due.length}</span><small>Due Today</small></div>
    <div class="review-stat"><span>${mastered}</span><small>Mastered</small></div>
    <div class="review-stat${atRisk.length ? ' review-stat-risk' : ''}"><span>${atRisk.length}</span><small>At Risk</small></div>
  `;
  document.getElementById('reviewStartRow').innerHTML = due.length
    ? `<button class="btn primary wide" onclick="beginReviewSession()">Start Review (${due.length})</button>`
    : `<div class="empty-hist">All caught up. Nothing due right now.</div>`;
  // At Risk verses (badly overdue) are the only ones worth calling out
  // individually — everything else in the queue is covered by the
  // single Start Review flow above, not a row-per-verse list.
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
  reviewQueue = due;
  showStage('reviewArea', due.length ? `${due.length} Due for Review` : 'Review');
}

function resolveReviewItem(item) {
  const group = DATA.find(g => g.cat === item.cat);
  const v = group.verses.find(x => x.ref === item.ref);
  const diffs = diffsForMode(item.suggested.mode);
  const difficulty = diffs ? (diffs.find(d => d.id === item.suggested.diffId) || diffs[0]) : null;
  return { verse: v, mode: item.suggested.mode, difficulty, cat: item.cat };
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

// The home screen has one "stage" area that's either the idle verse
// previews, or one of the three active-session UIs, never more than
// one at once — swapping between them is a same-page content swap
// (no showView/navigation), so the category header, mode picker, and
// category switcher all stay in place while a session runs.
const STAGES = ['verseList', 'reviewArea', 'practiceArea', 'matchArea', 'scoreArea'];
function showStage(name, title) {
  STAGES.forEach(id => { document.getElementById(id).style.display = (id === name) ? '' : 'none'; });
  const isIdle = name === 'verseList';
  document.getElementById('stageBack').style.display = isIdle ? 'none' : 'flex';
  document.getElementById('setupArea').style.display = isIdle ? '' : 'none';
  // The review queue spans every category, so the single-category
  // header (correct for every other stage, including review-launched
  // single-verse sessions — startReviewItem() sets state.cat to that
  // verse's real category) would be stale/misleading here specifically.
  document.getElementById('catHeader').style.display = (name === 'reviewArea') ? 'none' : '';
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
  state.stepConfigs = undefined;
  showStage('verseList');
}

function modeLabel(m) {
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

  const title = state.stepConfigs ? 'Review' : roundTitle(state.mode, state.difficulty);
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
  state.results.push({ ref: v.ref, score: pct, detail: `${correct}/${inputs.length} blanks correct` });
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
  state.results.push({ ref: v.ref, score: pct, detail: `${correct}/${inputs.length} weak words fixed` });
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
      <textarea id="typeInput" placeholder="Type the verse from memory..."></textarea>
      <div id="typeResult"></div>
    `;
  } else {
    card.insertAdjacentHTML('beforeend', `
      <textarea id="typeInput" placeholder="Type the full verse..." style="margin-top:14px;"></textarea>
      <div id="typeResult"></div>
    `);
  }
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="checkType()">Check</button>`;
}
function checkType() {
  const btn = document.getElementById('rateRow');
  if (btn.dataset.checked === '1') { state.stepIndex++; showStep(); return; }
  const v = state.sessionVerses[state.stepIndex];
  const typed = document.getElementById('typeInput').value.trim().split(/\s+/).filter(Boolean);
  const actual = v.text.split(' ');
  const matched = alignWords(actual, typed);
  let correctCount = 0;
  const missed = [];
  const diffHtml = actual.map((w, i) => {
    if (matched[i]) { correctCount++; return `<span class="ok">${w}</span>`; }
    missed.push(normWord(w));
    return `<span class="miss">${w}</span>`;
  }).join(' ');
  // Denominator counts extra typed words too, not just the actual
  // verse's word count — otherwise an inserted word that doesn't
  // displace any real word goes completely unpenalized, since every
  // actual word can still be found in order in the LCS alignment.
  const pct = Math.round((correctCount / Math.max(actual.length, typed.length)) * 100);
  document.getElementById('typeResult').innerHTML = `
    <div class="score-line">${pct}% word match</div>
    <div class="diff-line">${diffHtml}</div>
  `;
  state.results.push({ ref: v.ref, score: pct, detail: `${correctCount}/${actual.length} words correct` });
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
    <textarea id="typeInput" placeholder="Type it..."></textarea>
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
  const typed = document.getElementById('typeInput').value.trim().split(/\s+/).filter(Boolean);
  const actual = targetText.split(' ');
  const matched = alignWords(actual, typed);
  let correctCount = 0;
  const missed = [];
  const diffHtml = actual.map((w, i) => {
    if (matched[i]) { correctCount++; return `<span class="ok">${w}</span>`; }
    missed.push(normWord(w));
    return `<span class="miss">${w}</span>`;
  }).join(' ');
  // Denominator counts extra typed words too, not just the actual
  // verse's word count — otherwise an inserted word that doesn't
  // displace any real word goes completely unpenalized, since every
  // actual word can still be found in order in the LCS alignment.
  const pct = Math.round((correctCount / Math.max(actual.length, typed.length)) * 100);
  document.getElementById('typeResult').innerHTML = `
    <div class="score-line">${pct}% word match</div>
    <div class="diff-line">${diffHtml}</div>
  `;
  const isLastLink = state.chunkIndex === state.chunks.length - 1;
  if (isLastLink) {
    // The final link is the whole verse, recalled cumulatively from a
    // bare textarea — a real free-recall event, same standing as By
    // Heart for spaced-repetition purposes.
    state.results.push({ ref: v.ref, score: pct, detail: `${correctCount}/${actual.length} words correct (full verse)` });
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
  state.results.push({ ref: correctRef, score: tier.score, detail });
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
  showScoreScreen(score, timeSec, [], [
    { label: 'Pairs', value: matchState.total },
    { label: 'Misses', value: matchState.mistakes }
  ]);
}

function finishSession() {
  const timeSec = Math.round((Date.now() - state.startTime) / 1000);
  const avg = Math.round(state.results.reduce((s, r) => s + r.score, 0) / state.results.length);
  // A review session spans multiple categories and modes, so it
  // doesn't fit the per-cat/mode leaderboard schema — only log
  // straight single-mode practice sessions.
  if (!state.stepConfigs) logAttempt(state.cat, state.mode, state.difficulty ? state.difficulty.name : '', avg, timeSec);
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
    reviewList.innerHTML = results.map(r => `
      <div class="review-item">
        <div class="review-ref">${r.ref}<span class="review-pct">${r.score}%</span></div>
        <div class="review-detail">${r.detail}</div>
      </div>
    `).join('');
  } else {
    reviewBtn.style.display = 'none';
    reviewList.style.display = 'none';
  }
  const scoreHistory = document.getElementById('scoreHistoryBody');
  const scoreHistoryLabel = scoreHistory.previousElementSibling;
  if (state.stepConfigs) {
    // Mixed-mode, mixed-category review session — no single cat/mode
    // leaderboard applies here.
    scoreHistory.innerHTML = '';
    if (scoreHistoryLabel) scoreHistoryLabel.style.display = 'none';
  } else {
    if (scoreHistoryLabel) scoreHistoryLabel.style.display = '';
    scoreHistory.innerHTML = leaderboardMarkup(5, state.cat, modeLabel(state.mode), state.difficulty ? state.difficulty.name : '');
  }
  document.getElementById('nextDueBtn').style.display = state.isReviewSession ? 'block' : 'none';
  // A flowing review session's queue isn't a single cat/mode/difficulty
  // config replaySession() can reconstruct — "Next Due Verse" is
  // already the sensible restart action here.
  document.getElementById('playAgainBtn').style.display = state.stepConfigs ? 'none' : 'block';
  const title = state.stepConfigs ? 'Review' : roundTitle(state.mode, state.difficulty);
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

function openAbout() { showView('view-about'); }

// The markup uses inline onclick="" handlers (kept as-is from the
// original single-file version — rewiring to addEventListener isn't
// needed for this app's size and would just be churn). Since this
// file is loaded as an ES module, its top-level functions are NOT
// implicitly global, so the ones referenced from index.html's
// onclick attributes must be attached to window explicitly.
Object.assign(window, {
  goHome, showView, replaySession, toggleReview,
  checkFade, nextStep, checkType, startPractice, cancelSession, openReview,
  checkWeakLink, checkChainBuild, openAbout, beginReviewSession
});

loadProgress().then(loadHistory);
