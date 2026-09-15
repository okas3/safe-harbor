# UX / Product Design Review — Anchor Scriptures

An elite-UX-designer evaluation of the app's layout, flow, and interaction
design, done against the retention-app playbook (Duolingo, Anki, Blinkist):
reduce cognitive load, make the right next action obvious, and surface the
learning-science machinery that already exists under the hood instead of
burying it in a settings menu.

This complements `MEMORY-SYSTEM-REVIEW.md`, which covers *what the modes
test*; this covers *how the interface presents that testing to a user*.

## 1. Home Screen: Passive Browser → Retention Dashboard

The home screen currently leads with "browse a category, then pick a mode."
Review is a secondary button below the fold; due-count is invisible until
you tap into it. That's backwards for a retention app — Review should be
the front door once there's real due content, not a button competing with
seven category pills.

- No streak mechanic exists anywhere in `progress.js` — no daily-visit or
  daily-completed-session tracking. The single highest-leverage engagement
  lever in this genre is fully unbuilt.
- The app already avoids showing a due-count to a fresh account (good
  instinct, see the reasoning comment at `app.js:178`) — that same
  restraint should extend to *promoting* Review to the primary CTA once
  `due.length > 0`, rather than requiring a nav tap to discover it.
- Any new aggregate stats surface must not duplicate what the per-verse
  stage badges already say — this app already fought and won that fight
  once this session (removing redundant theme-tags); a second dashboard
  repeating the same info would be the same mistake in a new location.

## 2. Mode Selection vs. Guided Curriculum

`suggestedModeForStage()` already computes the right next mode+difficulty
per category — the curriculum engine exists. It's just invisible: the
dropdown shows the suggestion with zero visual distinction from a fully
free manual pick, so a user has no way to know a recommendation is even
happening.

- Invert the current structure: make the suggested mode+difficulty a big
  primary "Continue" action, demote the manual dropdown to a secondary
  "or choose a mode" disclosure. Same primary/secondary pattern already
  applied to the score screen's Play Again button and Review's Start
  Review button this session.
- Note: the suggestion is computed per category (from its *weakest*
  verse), matching the app's whole-category session structure — this
  isn't a per-verse routing change, just making an existing aggregate
  recommendation visible.
- The recognition → cued → free ladder is real in `STAGE_RANK` but never
  rendered as a path. A simple progress breadcrumb per verse would make
  it visible instead of requiring badge-reading.

## 3. Micro-Interactions & the Mastery Gate

The sharpest gap. `PASS_THRESHOLD = 90` (`progress.js:13`) silently gates
stage advancement, but the score screen renders 80% and 95% with an
identical layout — nothing tells the user 80% didn't count for anything.

- The fix is per-verse, not per-screen: `state.results` already carries
  a score per verse, and the existing `reviewList`/`.review-item` markup
  already lists them — annotate each row with pass/fail against the same
  90% threshold `recordRecall` uses, rather than trying to binary-flag
  the whole score screen (a session average can be 85% while every
  individual verse passed, or vice versa).
- On a fail, the primary next action shouldn't be "Play Again" (replays
  the whole mode from scratch). `wordMisses` already tracks exactly which
  words are the problem — the primary action should jump straight into a
  Weak Link drill scoped to just this verse.

## 4. The Visual Anchor Gap (Dual-Coding)

Worth stating plainly: this app *had* memory hooks, and they were cut
earlier this same session, on request, because the feature had two real
failure modes — image upload depended on a manually-linked Vercel Blob
store that silently degraded, and the hook UI (icon + editor) was
permanent chrome on every verse card whether anyone used it or not.
Any reintroduction needs to not repeat both of those mistakes:

- Drop the image-upload dependency. A typed one-line mental-image
  description captures most of the dual-coding benefit with zero infra
  risk; if photos matter later, a local data-URI needs no server or
  token to silently break.
- Attach the prompt to a moment, not permanent chrome — e.g. a one-time
  dismissible nudge the first time a verse crosses new → recognized,
  and a collapsed toggle (not an always-rendered snippet) during recall
  modes, preserving the recall-from-nothing testing-effect philosophy
  the app's own About page already argues for.
- **This section should not be built without an explicit go-ahead** —
  it directly reverses a deliberate removal from minutes earlier in this
  same session.

## 5. Direct UX Red Flags

- **Verified bug, not a UX opinion:** `checkType()` and
  `checkChainBuild()` grade typed recall by raw positional index
  (`typed[i]` vs `actual[i]`, `app.js:546`) — not alignment/edit-distance.
  Drop or add one word early in a long verse and every subsequent word
  misregisters as wrong, even if the rest was typed perfectly. This
  actively erodes trust: a user who knows they recalled it correctly
  gets punished by an implementation detail, not their memory.
- Sessions are all-or-nothing — `cancelSession()` discards in-progress
  state rather than pausing it. No "come back to this later" for a long
  Review queue.
- No reward differentiation between a 100% and a 60% beyond the number
  itself — a well-proven retention lever (salience of success) sitting
  unused.

## Priority order

1. **Fix the positional grading bug** (#5) — this is a correctness bug
   wearing a UX costume, not a taste call. Affects By Heart and Anchor
   Chain Build.
2. **Surface the mastery gate per-verse** (#3) — the data already exists;
   this is a rendering gap, not new tracking.
3. **Make the suggested mode primary** (#2) — low-risk, matches a pattern
   already established elsewhere in the app this session.
4. **Promote Review + add a streak signal** (#1) — real value, but scoped
   correctly matters (single-user app; don't over-build a dashboard for
   an audience of one).
5. **Dual-coding v2** (#4) — hold until explicitly requested; reverses a
   just-made decision.

## Implementation log

Status of the above, updated as work lands:

- [x] 1. Positional grading fix — By Heart, Anchor Chain Build now grade
      via LCS word-alignment (`alignWords()` in `app.js`) instead of raw
      index comparison. Verified: a dropped word no longer cascades into
      marking everything after it wrong. Side effect worth knowing: an
      *inserted* extra word is no longer penalized either (every actual
      word can still be found in order) — a deliberate tradeoff, not a
      bug, but flagged in case exact word-count matters more than this.
- [ ] 2. Per-verse pass/fail annotation on the score screen's review list
- [ ] 3. Suggested-mode-as-primary-action on the home screen
- [ ] 4. Streak tracking + Review promoted to primary CTA when due
- [ ] 5. Dual-coding v2 — not started, pending explicit request
