---
description: Build the next four Palm/Mute phases in order (tests, UX fixes, power-chord engine, melody and solo), each on its own branch with a PR, safely and without stopping for decisions already made.
---

You are continuing work on Palm/Mute in this repository, running unattended in auto mode. Follow `CLAUDE.md` at all times: feature branches and PRs only, **never merge a PR**, never push to `main`, no force-push, no destructive git commands, no skipped checks, lint and build must pass before every PR, and use `data/*.json` and the design tokens as the sources of truth.

## 0. Preflight (stop if any check fails)

1. Run `git fetch origin` and confirm the working tree is clean.
2. Confirm these files exist on `origin/main`:
   - `docs/power-chord-engine-brief.md`
   - `docs/melody-and-solo-brief.md`

   If either is missing, **stop** and tell the owner which PR to merge or which file to add. Don't recreate them.
3. Read `CLAUDE.md`, `DECISIONS.md`, both briefs, and this routine in full before changing anything.
4. Run `npm ci`, `npm run lint`, `npm run build` and `npm run verify` on `main`. If `main` is already broken, **stop** and report; don't fix unrelated breakage silently.

## 1. Decisions already made (don't ask again; record them in `DECISIONS.md`)

The owner confirmed these on 2026-09-27:

| Decision | Answer |
|---|---|
| Build order | 1 Tests → 2 UX fixes → 3 Power-chord engine → 4 Intro melody and solo |
| Fret limit | **Chords: 12. Lead solos: 15.** Intro melodies: 12. |
| Tab layout in cards | **Wrap 2 bars per line** inside the card; never scroll sideways; readable at 320px |
| Test tooling | **Add Playwright** as a dev dependency and run it in CI |

**Defaults for the remaining open questions.** Use these unless `DECISIONS.md` already says otherwise, and list them in each PR description so the owner can change them:

| Question (brief) | Default |
|---|---|
| Chord library (engine §13.3) | Generate `data/chord-library.json` from the new shape data. Chords-page chips show the voicing the engine picks for that progression. |
| Pre-chorus or final-chorus lift (engine §13.4) | Not now: keep the 5 sections |
| Neck control (engine §13.5) | Automatic only; no Low/Mid/High control |
| 16th-note gallops (engine §13.6) | Off |
| Default intro style (melody §11.2) | Hook (Octaves and Harmony also available) |
| Lengths (melody §11.4) | Intro 4 bars, solo 8 bars (both selectable) |
| Technique notation (melody §11.5) | Standard: `b`, `r`, `h`, `p`, `/`, `\`, `~` |
| "Use in my song" (melody §11.6) | Replaces the Generator's Intro or Solo section (still lockable) |
| Feel on the Chords page (melody §11.7) | A full Feel control, sharing state with the Generator |
| Locked section after a key change (UX) | Keep "frozen once locked", but show "Locked in {key}" on the card, with a one-tap "Update to {new key}" action |
| Originality badge on the Generator (UX) | Replace "ORIGINALITY CHECK · PASS" with "CHORD PATTERNS ONLY · NO TABS STORED" |
| Audio when leaving a page (UX) | Stop playback when leaving the Generator or the Chords page |

## 2. How to branch and open PRs (important)

The owner merges PRs later, so each phase builds on the previous phase's branch:

- Phase 1: branch `feature/e2e-tests` from `origin/main`.
- Phase 2: branch `fix/ux-gaps` from `feature/e2e-tests`.
- Phase 3: branch `feature/expert-voicings` from `fix/ux-gaps`.
- Phase 4: branch `feature/melody-and-solo` from `feature/expert-voicings`.

**Open every PR against `main`,** not against the previous branch. Each later PR will include the earlier phases' commits until those are merged. At the top of each PR description, write: "**Merge #N first** (this PR includes its commits until then). Use *Create a merge commit*." This avoids a trap we hit before: stacked PRs targeting a feature branch got merged into that branch instead of `main`.

If a branch name already exists, add `-2`, `-3` and so on.

## 3. The phases

### Phase 1: Committed browser tests (`feature/e2e-tests`)

1. Add `@playwright/test` as a dev dependency with `npm install -D @playwright/test`, and add `playwright.config.ts`. It should build and serve the static export (`out/`) on a local port, and run in Chromium and WebKit at 320, 390, 834, 1440 and 1920px, in light and dark.
2. Add `npm run test:e2e`. Update `.github/workflows/build-check.yml`: after lint and build, install the Playwright browsers (`npx playwright install --with-deps chromium webkit`) and run `npm run test:e2e`.
3. Write tests for the **current** site, with the same coverage as the ad-hoc checks used in earlier sessions:
   - **Routes:** `/`, `/generator/` and `/chords/` load with the right `<h1>` and title; `/about/` falls back to `/`.
   - **Menu (Shutter):** opens and closes (button and Esc, with focus returning), closes when navigating, locks scroll, lights no band on open, and never shows red text on a red band.
   - **Dark mode:** the toggle works, persists and follows the OS by default.
   - **Generator:** keys update the chords, lock and regenerate work, the feel changes the strum, the Mid-Tempo stepper runs 120–150, and the key is kept between the Generator and Chords.
   - **Layout:** 5 columns at 1280px and 2 at 1279px; no horizontal overflow on any page.
   - **Count In:** every headline line fits its column at all widths and scroll positions; the G5 diagram geometry is right.
   - **Title board:** all 90 titles fit one line at every width, and there are no repeats until all 90 have been shown.
   - **Chords:** all chips are the same width.
   - **Everywhere:** no console errors.
4. All tests pass locally. Open a PR; its description lists what's covered.

### Phase 2: Must-fix UX gaps (`fix/ux-gaps`)

Fix these, with a Playwright test for each:
- **Generator:**
  - The locked-section key label and "Update to {key}" action.
  - A Play button per section, plus "Play song". Both play what's shown, at the selected feel.
  - Choosing the Chorus progression by clicking a Power Chords row.
  - Playback stops when leaving the page.
  - The new originality badge text.
- **Chords:**
  - Selecting a card opens a panel with "Use in my song" (key and Chorus progression into the Generator).
  - A Feel control.
  - A "Most common" label on the highlighted card.
  - Play icons that only fill while playing.
  - Degree labels (I, V, vi, IV) on the chips.
- **Both pages:**
  - Tap targets at least 44px, with larger hit areas where the visual size must stay small.
  - No text below 12px except decorative tab art that has a text alternative.
  - Contrast at least 4.5:1 for small text in light and dark (fix it with tokens, not one-off colors).
  - Screen-reader text for tabs and chips: note and chord names instead of dashes.
- **Leave for later** (list in the PR as follow-ups): undo, copy/print/share, a song title on the Generator, remembering settings, a song overview, Rhythm Lane affordance, mobile page length.

### Phase 3: Expert power-chord engine (`feature/expert-voicings`)

Follow `docs/power-chord-engine-brief.md` exactly, using the decisions in section 1 of this routine: fret limit 12 for chords, wrap 2 bars per line, generate the chord library, 5 sections, automatic neck, no gallops.
1. Pure logic in `lib/` (a shared `lib/fretboard.ts` for string maths, fingering and tab rendering; `lib/voicings.ts` for candidates and path search), with settings and recipes in `data/`.
2. Extend `npm run verify` with every invariant in brief §11 across all keys × progressions × feels × sections × 50 seeds, plus about 10 reference tabs at seed 0 (including brief §4's hand-checked G examples).
3. **Mock-up for the owner:** before the site changes, write a standalone `docs/mockups/expert-voicings.html` showing generated tabs for several keys, sections and feels, with playback. Commit it in this PR so the owner can review it; don't wait for approval.
4. Build into the Generator, the Power Chords panel and the Chords page, plus audio. Update the Playwright tests: tabs wrap to 2 bars per line with no overflow from 320 to 1920px, and the audio notes equal the tab.
5. Open a PR with the verify results, the test results and the defaults used.

### Phase 4: Intro melody and lead solo (`feature/melody-and-solo`)

Follow `docs/melody-and-solo-brief.md`, reusing `lib/fretboard.ts` and the Phase 3 tab component. Fret limits: **12 for intros, 15 for solos.** Defaults as in section 1 of this routine.
1. `lib/melody.ts` plus `data/lead-rules.json` and `data/lead-rhythms.json`; replace the Generator's old Solo lick with the new solo engine.
2. Extend `npm run verify` with brief §12's invariants (scale, strong-beat chord notes, leaps, endings, bends from scale note to scale note, positions, determinism) × all keys × progressions × parts × styles × 50 seeds, plus reference outputs, including brief §4's G hook.
3. Mock-up: `docs/mockups/melody-and-solo.html`, with playback, committed for review.
4. Build the panel on the Chords page (Intro melody and Lead solo tabs; Generate, Play with backing, Play lead only, Copy tab, Use in my song) and the Generator hand-off, with Playwright tests.
5. Open a PR.

## 4. Rules for the whole run

- **Explain as you go:** at the start of each phase, write a short plan in the session. At the end, summarise what changed and what was checked.
- **Commit often,** with clear messages ending in the attribution lines your harness specifies.
- **Checks before every PR:** `npm run lint`, `npm run build` and `npm run verify` must all pass. Paste their summaries into the PR description. Don't run `npm run test:e2e` locally unless the user asks; GitHub runs it on every PR (see CLAUDE.md).
- **Musical correctness is non-negotiable:** never ship a tab, voicing, melody or bend that the automated checks can't prove correct.
- **Visual review:** after building each phase, take screenshots at 390 and 1440px in light and dark, look at them, and fix anything clipped, overlapping or unreadable before opening the PR.
- **Stop and report** instead of guessing if:
  - a check fails and you can't fix it after a reasonable attempt
  - a change would contradict `DECISIONS.md` or an approved design
  - you need a new runtime dependency beyond Playwright
  - a permission is denied
- **Never** merge PRs, delete other branches, change repository settings, or touch anything outside this repo.

## 5. Final report

When all four PRs are open (or you've stopped), finish with a message listing:
- each PR link and its merge order
- the check results per phase
- the defaults used
- anything deferred or not verifiable, including **the guitarist listening test on the two mock-ups**, which only the owner can do
