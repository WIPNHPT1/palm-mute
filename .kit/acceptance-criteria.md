# Palm/Mute — Acceptance Criteria

Self-check list for Claude Code to verify against before calling the build done — written so it doesn't need you to eyeball every screen.

## Visual parity (against the 9 mockups)
- [ ] Generator, Chords, About pages match the mockups' layout/spacing/color/type at desktop (1440), tablet (834), and mobile (390) widths.
- [ ] All 12 key pills render correctly (single letters for naturals, stacked two-line labels for sharps/flats), matching `design-tokens.json` sizing.
- [ ] Section cards show BOTH the regenerate and lock icon (per the latest revision), with Verse locked (dark lock icon) by default and all others unlocked (muted icons) on first load.
- [ ] Generate button is the rounded-pill shape (icon + "GENERATE" label) on desktop/tablet — NOT a circle (this was tried and reverted).
- [ ] Chords pages do NOT show the "Every progression below is voiced..." line (removed).
- [ ] Responsive reflow matches `component-spec.md` exactly (5-col → 2-col → 1-col section grid; Key/Feel/Sort stacking rules per breakpoint; Chords progression list 2×3 → 1-col → vertical mini-cards).

## Functional correctness
- [ ] Selecting any of the 12 keys updates the Power Chords panel, Rhythm Lane example, and all unlocked sections — verify at least 3 non-A keys (e.g. C, F#, D#) produce musically correct fret numbers per `chord-library.json`, not copies of the A-key example.
- [ ] Locking a section prevents both the Generate button and that section's own regenerate icon from changing its content; unlocking re-enables both.
- [ ] Feel toggle changes the Rhythm Lane pattern and section strum notation; selecting Mid-Tempo reveals a tempo control (120-150 range); Fast Punk/Half-Time show fixed, non-editable BPM.
- [ ] Chords page Sort toggle re-orders the 6 progression cards without changing their content.
- [ ] Solo section's lead lick is computed via the `leadLickFormula` (not hardcoded) — verify it produces `5,7,5,7` for Key of A (matching the original mockup) and correct values for at least one other key.
- [ ] "Stuck on a song title?" generates a new title on interaction, pulling from `title-generator.json`, without immediate repeats.
- [ ] Navigating between Generator ↔ Chords preserves the selected key (per `interaction-spec.md` §4).

## Audio (if built in this pass — flag if deferred)
- [ ] Clicking a progression/chip's play icon produces audible playback at the correct pitch for the selected key (spot-check 2-3 keys, not just A).
- [ ] Playback tempo matches the selected Feel/BPM; Half-Time audibly differs in drum feel from Fast Punk despite the same master tempo.
- [ ] No console errors from browser audio-autoplay restrictions — first play click should work, not require a page reload.

## Build/deploy
- [ ] `npm run build` produces a static export with no errors.
- [ ] Netlify deploy succeeds from a fresh clone with zero manual dashboard configuration beyond connecting the repo (i.e. `netlify.toml` fully specifies build command + publish dir).
- [ ] Deployed site's three routes (`/`, `/chords`, `/about`) all load directly (not just via in-app navigation) — confirms the redirect/export config in `netlify.toml` is correct.
- [ ] No hardcoded `localhost` URLs, no missing env vars required for a basic page load.

## Explicitly out of scope for v1 (don't block on these)
- Dark mode (toggle can be visually present but non-functional, or removed — see `interaction-spec.md` §2)
- Full originality-check algorithm (default to always-PASS unless you've confirmed otherwise per `data-model.md` §6)
- Solo section note-level variation on regenerate (rhythmic variation only is fine)
- Any user accounts, saving/sharing generated songs, or backend persistence — this is a stateless client-side prototype
