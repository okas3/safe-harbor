# Memory System Review — Anchor Scriptures

An expert-mnemonist evaluation of the app's learning design, done against
the stated goals: memorize for life, scale to hundreds of verses over
time (eventually characters/events/principles too), single user for now.

## 1. Cognitive Effectiveness

Splitting the five modes by what they actually test:

- **Recognition, not recall** — Safe Harbor (matching) and Dead Reckoning
  (multiple-choice) only require discriminating among options. Useful for
  building the reference↔content association early, but passing them
  doesn't mean you could recite the verse to someone. Recognition ≠ recall.
- **Cued recall** — Chain of Initials and mid-tier Fathom by Fathom are
  genuine retrieval practice with scaffolding (testing effect, Roediger &
  Karpicka). Well designed.
- **Free recall** — By Heart and high-tier Fathom by Fathom (75–92%
  blanked) are the only modes approaching true verbatim production from a
  bare cue — the gold standard for durable memory. Underweighted: only
  1.5 of 5 modes train it.

**Missing: dual coding.** Paivio's dual-coding theory — pairing verbal
material with an imagery/visual/spatial code — is one of the most robust
findings in memory research and roughly doubles durability for a lot of
people. The system is 100% text-in/text-out. High-leverage once the
library expands into characters/events (much easier to visualize a
narrative than an abstract doctrinal statement).

**Missing, and the one that matters most given "for life" + "hundreds of
verses": spaced repetition.** Nothing tracks decay over time or tells the
user what's actually at risk of being forgotten.

## 2. Friction & Progression

Fathom by Fathom's five-tier ramp (10/25/50/75/92%) is well-graduated —
no cliff there.

Two real cliffs:

- **Chain of Initials doesn't scale with its own difficulty setting.**
  Both tiers end in the identical test (type the whole verse cold, graded
  word-by-word) — the difficulty only changes the warm-up cueing, not the
  graded moment itself.
- **No enforced or suggested path between modes.** A user can go straight
  to By Heart on a verse they've never seen — cold recall, zero
  scaffolding, no warning. The five modes are independent menu items, not
  a curriculum.

## 3. Verbatim Mastery

No mastery gate exists. Every mode treats one attempt as terminal — you
get a percentage, see the answer, click Next. An 80%-word-match attempt
and a 100% attempt are recorded identically as "a completed attempt."
For traditions that demand word-perfect recitation, 80% is not a pass.

Related: every retry re-tests the *entire* verse from scratch — no
isolation of specific words/phrases someone keeps missing ("weak link"
drilling, a staple memory-athlete technique).

## 4. Missing Links — priority order

1. **Spaced-repetition scheduler** (SM-2 or Leitner box), per-verse
   interval/ease state. The load-bearing piece — everything below either
   depends on it or is much less valuable without it.
2. **Review/Due-Today queue** as the primary home-screen action —
   pulls due verses across all categories once the scheduler exists.
3. **Mastery-gated progression per verse** (New → Recognized → Cued
   Recall → Free Recall → Mastered → Maintenance), requiring
   verbatim-perfect performance to advance a stage; app suggests the
   next mode rather than leaving it to chance.
4. **Weak-word re-drill** — track per-word miss frequency across
   attempts, offer a short targeted re-test of just the trouble spots.
5. **Dual-coding/imagery hooks** — a lightweight per-verse "memory hook"
   (keyword/image/mental picture note).
6. **Phrase-level chunked building** for longer passages — classic
   chaining technique (memorize phrase 1, add phrase 2, cumulative
   recite, add phrase 3, ...). Needed once passages/narratives are added,
   not just single verses.
7. **Reframe the "High Score" leaderboard** — currently rewards
   speed-running verses you already know, which is mildly
   counter-productive for spaced retention. Once scheduling exists,
   surface retention-health metrics instead (streak, verses at risk of
   lapsing, verses in maintenance).
8. **Thematic/tag-based linking** rather than one fixed category per
   verse — real content overlaps thematically, especially once
   characters/events/principles are added.

## Implementation log

Status of the above, updated as work lands:

- [x] 1. Spaced-repetition scheduler — `src/progress.js`, simplified SM-2
- [x] 2. Due-Today review queue — home screen banner + cross-category queue
- [x] 3. Mastery-gated progression — new/recognized/cued/free/mastered/maintenance stages, suggested-mode defaults
- [x] 4. Weak-word re-drill — Weak Link mode
- [x] 5. Dual-coding/imagery hooks — per-verse text note + image (Vercel Blob), shown during recall modes
- [x] 6. Phrase-level chunked building — Anchor Chain Build mode
- [x] 7. Retention-health stats (leaderboard reframe) — Due Today/Mastered/At Risk banner; per-category High Score kept as-is
- [x] 8. Thematic/tag-based linking — data model (`tags: []` on every verse) + History filter chips, no tag values populated yet

All 8 items shipped. Two review-flow bugs found in testing and fixed:
stale category header while browsing the cross-category due list, and
no "next due verse" path after finishing a review-launched session.
