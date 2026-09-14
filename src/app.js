import './style.css';
import { DATA } from './verses.js';
import { FADE_DIFFS, LETTER_DIFFS, MATCH_DIFFS, REVERSE_DIFFS } from './difficulties.js';
import { CATEGORY_ICONS, ANCHOR_ICON } from './icons.js';
import { loadProgress, recordRecognition, recordRecall, recordWordMisses, getProgress, getDueVerses, suggestedModeForStage } from './progress.js';

document.getElementById('h1IconLeft').innerHTML = ANCHOR_ICON;
document.getElementById('h1IconRight').innerHTML = ANCHOR_ICON;

const HISTORY_KEY = 'scripture-history-v3';

const MODES = [
  { id: 'match', label: 'Safe Harbor', hint: 'Match the Pairs', desc: 'All references and verses laid out at once. Tap to pair them correctly, race the clock.' },
  { id: 'reverse', label: 'Dead Reckoning', hint: 'Name the Reference', desc: 'Read the verse with no reference shown, then pick which passage it comes from.' },
  { id: 'fade', label: 'Fathom by Fathom', hint: 'Fill in the Blanks', desc: 'Words go blank as you dial up the depth. Type the missing word in place, graded on the spot.' },
  { id: 'letters', label: 'Chain of Initials', hint: 'First-Letter Cues', desc: 'Only initials shown. Recite from the skeleton, then type the full verse to be graded.' },
  { id: 'type', label: 'By Heart', hint: 'Type from Memory', desc: 'Just the reference. Type the whole verse. Graded word by word.' }
];
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

// Builds the <optgroup>/<option> tree once. Option values encode
// "mode:diffId" (or just "mode" for By Heart, which has no tiers) so
// the change handler can recover both state.mode and state.difficulty
// from a single select value.
function buildModeOptions() {
  const select = document.getElementById('modeSelect');
  select.innerHTML = MODES.map(m => {
    const diffs = diffsForMode(m.id);
    const options = diffs
      ? diffs.map(d => `<option value="${m.id}:${d.id}">${d.name}</option>`).join('')
      : `<option value="${m.id}">${m.label}</option>`;
    return `<optgroup label="${m.label} — ${m.hint}">${options}</optgroup>`;
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

  document.getElementById('verseList').innerHTML = group.verses.map(v => `
    <div class="verse-card">
      <div class="verse-card-ref">${v.ref}</div>
      <div class="verse-card-text">${v.text}</div>
    </div>
  `).join('');

  const select = document.getElementById('modeSelect');
  select.value = state.difficulty ? `${state.mode}:${state.difficulty.id}` : state.mode;
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
  renderHome();
}

function startPractice() { beginSession(); }

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
const STAGES = ['verseList', 'practiceArea', 'matchArea', 'scoreArea'];
function showStage(name, title) {
  STAGES.forEach(id => { document.getElementById(id).style.display = (id === name) ? '' : 'none'; });
  const isIdle = name === 'verseList';
  document.getElementById('stageBack').style.display = isIdle ? 'none' : 'flex';
  document.getElementById('setupArea').style.display = isIdle ? '' : 'none';
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
  showStage('verseList');
}

function modeLabel(m) {
  return MODES.find(x => x.id === m)?.label || m;
}

function normWord(w) {
  // Strip everything but letters/digits/apostrophes, then drop any
  // apostrophe left dangling at the start or end of the word — those
  // are stray closing/opening quote marks from nested quotations in
  // the verse text (e.g. "...to you.'\""), not real contractions.
  // A contraction's apostrophe sits between letters, so it survives.
  return (w || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
}

function beginSession() {
  state.lastConfig = { cat: state.cat, mode: state.mode, difficulty: state.difficulty };
  const group = DATA.find(g => g.cat === state.cat);
  state.sessionVerses = group.verses.slice();
  state.stepIndex = 0;
  state.results = [];
  state.startTime = Date.now();

  if (state.mode === 'match') { beginMatch(); return; }

  const title = modeLabel(state.mode) + (state.difficulty ? ' · ' + state.difficulty.name : '');
  showStage('practiceArea', title);
  showStep();
}

function replaySession() {
  state.cat = state.lastConfig.cat;
  state.mode = state.lastConfig.mode;
  state.difficulty = state.lastConfig.difficulty;
  beginSession();
}

function showStep() {
  if (state.stepIndex >= state.sessionVerses.length) { finishSession(); return; }
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
    <div class="theme-tag">${state.cat} · fade</div>
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

function renderLettersIntro(v) {
  const words = v.text.split(' ');
  const every = state.difficulty.every;
  const initials = words.map((w, i) => {
    if (i % every !== 0) return '▁';
    const m = w.match(/[A-Za-z]/);
    return m ? m[0] : w[0];
  }).join(' ');
  const card = document.getElementById('flashcard');
  card.innerHTML = `
    <div class="theme-tag">${state.cat} · first-letter cue</div>
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
      <div class="theme-tag">${state.cat} · type from memory</div>
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
  let correctCount = 0;
  const missed = [];
  const diffHtml = actual.map((w, i) => {
    const match = typed[i] && normWord(typed[i]) === normWord(w);
    if (match) correctCount++;
    else missed.push(normWord(w));
    return `<span class="${match ? 'ok' : 'miss'}">${w}</span>`;
  }).join(' ');
  const pct = Math.round((correctCount / actual.length) * 100);
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
function nextStep() {
  const row = document.getElementById('rateRow');
  row.dataset.checked = '';
  state.stepIndex++;
  showStep();
}

function renderReverse(v) {
  // Distractor pool: the rest of the current category always; on Hard,
  // also pull in one other whole category for a wider, tougher pool —
  // same pattern as Safe Harbor's difficulty split.
  const group = DATA.find(g => g.cat === state.cat);
  let pool = group.verses.filter(x => x.ref !== v.ref).map(x => x.ref);
  if (state.difficulty.id === 'hard') {
    const others = DATA.filter(g => g.cat !== state.cat);
    const other = others[Math.floor(Math.random() * others.length)];
    pool = pool.concat(other.verses.map(x => x.ref));
  }
  pool = pool.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [v.ref, ...pool].sort(() => Math.random() - 0.5);

  const card = document.getElementById('flashcard');
  card.innerHTML = `
    <div class="theme-tag">${state.cat} · dead reckoning</div>
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
  const ok = btn.dataset.ref === correctRef;
  document.querySelectorAll('.ref-option').forEach(o => {
    o.disabled = true;
    if (o.dataset.ref === correctRef) o.classList.add('ok');
    else if (o === btn) o.classList.add('bad');
  });
  if (ok) recordRecognition(correctRef);
  state.results.push({ ref: correctRef, score: ok ? 100 : 0, detail: ok ? 'Picked the right reference' : `Picked ${btn.dataset.ref}` });
  document.getElementById('rateRow').style.display = 'flex';
  document.getElementById('rateRow').innerHTML = `<button class="action-btn" onclick="nextStep()">Next</button>`;
}

function beginMatch() {
  const group = DATA.find(g => g.cat === state.cat);
  let pairSource = group.verses.map(v => ({ ref: v.ref, text: v.text, cat: state.cat }));
  let snippetLen = 999;
  if (state.difficulty.id === 'hard') {
    const others = DATA.filter(g => g.cat !== state.cat);
    const other = others[Math.floor(Math.random() * others.length)];
    pairSource = pairSource.concat(other.verses.map(v => ({ ref: v.ref, text: v.text, cat: other.cat })));
    snippetLen = 6;
  }
  const snippetOf = (text) => {
    const words = text.split(' ');
    return words.length <= snippetLen ? text : words.slice(0, snippetLen).join(' ') + '…';
  };
  const refs = pairSource.map(p => ({ ref: p.ref })).sort(() => Math.random() - 0.5);
  const texts = pairSource.map(p => ({ ref: p.ref, snippet: snippetOf(p.text) })).sort(() => Math.random() - 0.5);

  matchState = { pairSource, refs, texts, matchedCount: 0, total: pairSource.length, mistakes: 0, selectedRef: null, startTime: Date.now() };

  renderMatch();
  showStage('matchArea', modeLabel(state.mode) + ' · ' + state.difficulty.name);
}

function renderMatch() {
  document.getElementById('matchStats').textContent = `${matchState.matchedCount}/${matchState.total} paired · ${matchState.mistakes} miss${matchState.mistakes === 1 ? '' : 'es'}`;
  const refCol = document.getElementById('matchRefCol');
  const textCol = document.getElementById('matchTextCol');
  refCol.innerHTML = '';
  textCol.innerHTML = '';
  matchState.refs.forEach(r => {
    const div = document.createElement('div');
    div.className = 'match-chip';
    div.textContent = r.ref;
    div.dataset.ref = r.ref;
    if (r.matched) div.classList.add('matched');
    if (matchState.selectedRef === r.ref && !r.matched) div.classList.add('selected');
    if (!r.matched) div.onclick = () => selectRef(r.ref);
    refCol.appendChild(div);
  });
  matchState.texts.forEach(t => {
    const div = document.createElement('div');
    div.className = 'match-chip';
    div.textContent = t.snippet;
    div.dataset.ref = t.ref;
    if (t.matched) div.classList.add('matched');
    if (!t.matched) div.onclick = () => selectText(t.ref);
    textCol.appendChild(div);
  });
}
function selectRef(ref) {
  matchState.selectedRef = (matchState.selectedRef === ref) ? null : ref;
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
  logAttempt(state.cat, state.mode, state.difficulty ? state.difficulty.name : '—', avg, timeSec);
  showScoreScreen(avg, timeSec, state.results, [{ label: 'Verses', value: state.results.length }]);
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
  document.getElementById('scoreHistoryBody').innerHTML = historyMarkup(5, { cat: state.cat, mode: modeLabel(state.mode) });
  const title = modeLabel(state.mode) + (state.difficulty ? ' · ' + state.difficulty.name : '');
  showStage('scoreArea', title);
}
function toggleReview() {
  const el = document.getElementById('reviewList');
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

// Shared between the full History view (no filter, every column) and
// the compact preview on the score screen (filtered to the category +
// mode just played, where those two columns and the avg-score tile
// would just repeat the same value on every row and are dropped).
function historyMarkup(limit, filter) {
  let entries = filter ? history.filter(h => h.cat === filter.cat && h.mode === filter.mode) : history;
  if (!entries.length) {
    return `<div class="empty-hist">No attempts logged yet. Run a category and it'll show up here.</div>`;
  }
  // Filtered = the score screen's leaderboard, not a log: rank by best
  // score first, fastest time as the tiebreaker, so row one is
  // literally the record to beat. Unfiltered (the full History view)
  // stays in the natural most-recent-first order.
  if (filter) entries = entries.slice().sort((a, b) => b.score - a.score || a.timeSec - b.timeSec);
  const totalAttempts = entries.length;
  const bestOverall = Math.max(...entries.map(h => h.score));
  const rows = entries.slice(0, limit).map((h, i) => {
    const d = new Date(h.ts);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = `${Math.floor(h.timeSec / 60)}:${(h.timeSec % 60).toString().padStart(2, '0')}`;
    const topRow = filter && i === 0 ? ' class="hi-score-row"' : '';
    return filter
      ? `<tr${topRow}><td>${dateStr}</td><td>${h.difficulty || '—'}</td><td>${h.score}%</td><td>${time}</td></tr>`
      : `<tr><td>${dateStr}</td><td>${h.cat}</td><td>${h.mode}${h.difficulty && h.difficulty !== '—' ? ' (' + h.difficulty + ')' : ''}</td><td>${h.score}%</td><td>${time}</td></tr>`;
  }).join('');
  const headerCols = filter
    ? `<th>Date</th><th>Difficulty</th><th>Score</th><th>Time</th>`
    : `<th>Date</th><th>Category</th><th>Mode</th><th>Score</th><th>Time</th>`;
  // The full History view gets the aggregate tiles (Attempts/Avg/Best);
  // the score screen's filtered preview skips them entirely — with the
  // list already scoped to one category+mode, the raw rows below say
  // more than a summary would, and "Attempts"/"Avg Score" here would
  // just restate what's visible in a glance down the table.
  let summary = '';
  if (!filter) {
    const avgScore = Math.round(entries.reduce((s, h) => s + h.score, 0) / totalAttempts);
    summary = `
      <div class="hist-summary">
        <div><span>${totalAttempts}</span><small>Attempts</small></div>
        <div><span>${avgScore}%</span><small>Avg Score</small></div>
        <div><span>${bestOverall}%</span><small>Best Score</small></div>
      </div>`;
  }
  return `
    ${summary}
    <table class="hist-table">
      <tr>${headerCols}</tr>
      ${rows}
    </table>
  `;
}

function openHistory() {
  document.getElementById('historyBody').innerHTML = historyMarkup(60);
  showView('view-history');
}

// The markup uses inline onclick="" handlers (kept as-is from the
// original single-file version — rewiring to addEventListener isn't
// needed for this app's size and would just be churn). Since this
// file is loaded as an ES module, its top-level functions are NOT
// implicitly global, so the ones referenced from index.html's
// onclick attributes must be attached to window explicitly.
Object.assign(window, {
  openHistory, goHome, showView, replaySession, toggleReview,
  checkFade, nextStep, checkType, startPractice, cancelSession
});

loadProgress().then(loadHistory);
