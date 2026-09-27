# Palm/Mute — Decisions

Answers to the open decisions in `.kit/README.md`, plus later calls from the repo owner. Future
sessions: use these instead of the kit's recommended defaults (see `CLAUDE.md`).

| Decision | Answer | Source |
|---|---|---|
| Originality-check badge | Always PASS for v1 (`lib/originalityCheck.ts` stub) | Recommended default |
| Locked sections across key changes | Frozen once locked — key/feel changes don't touch a locked section | Recommended default |
| Dark mode | **Build a real dark theme** (overrides the "disable for v1" default) | Repo owner, 2026-09-27 |
| Audio approach | Synthesized (Tone.js synths, no sample pack) | Recommended default |
| Chorus highlight | Always the Chorus card | Recommended default |
| Desktop breakpoint | **1280px** (tokens say 1440) so common laptop widths get the 5-column layout | Repo owner, 2026-09-27 |
| Solo regeneration | **Note-level variations** (was rhythm-only for v1) | Repo owner, 2026-09-27 |
| Navigation | **Hamburger menu at every size** — overrides the mockups' inline desktop/tablet links. The mockups' mobile link row under the header was also removed, since the menu covers navigation everywhere | Repo owner, 2026-09-27 |
| Menu style | **"Shutter" full-screen menu**: one full-width band per page wiping in from the left, red flood on hover/keyboard focus, bottom strip with dark toggle + GitHub. The top bar is sticky so the close button is always reachable. Picked from six mock-ups | Repo owner, 2026-09-27 |
| Wordmark | **Lightning bolt in place of the "/"**, flipping like a coin every ~3.5s ("Coin Flip"); still for reduced-motion users; screen readers hear "Palm/Mute" | Repo owner, 2026-09-27 |
| Home page | **"Count In"** at `/`: the Soundcheck design picked from three mock-ups, carrying the old About content (no em dashes; originality wording softened to what the site actually does). Generator moved to `/generator/`; `/about/` permanently redirects to `/` (netlify.toml, plus a client-side fallback page); menu is Count In · Generator · Chords | Repo owner, 2026-09-27 |
| Home headline | Font size fitted to the widest line so nothing clips; designed line breaks (6 lines under 834px, 4 above); lines start on their margins and scroll motion stays within each line's free space | Repo owner, 2026-09-27 |
| Power-chord diagram | Shows **G5** as the chord library voices it (E string 3rd fret + A string 5th fret), both notes fretted and joined, ✕ on the four muted strings, text legend | Repo owner, 2026-09-27 |
| Song titles | **90 hand-written titles** (approved list), no "(… Mix)" suffix, each ≤ 22 characters so the split-flap board always shows one line (letters fitted to the title, 13px minimum on a 320px phone, 34px max). **Shuffle bag**: no title repeats until all 90 have been shown; one deck per visit | Repo owner, 2026-09-27 |
| Next four phases: build order | **1 Tests → 2 UX fixes → 3 Power-chord engine → 4 Intro melody and solo**, one PR each | Repo owner, 2026-09-27 |
| Fret limits | **Chords: 12. Lead solos: 15. Intro melodies: 12** (config values, not hard-coded) | Repo owner, 2026-09-27 |
| Tab layout in cards | **Wrap 2 bars per line** inside the card; never scroll sideways; readable at 320px | Repo owner, 2026-09-27 |
| Test tooling | **Playwright** as a dev dependency, run in CI (Chromium + WebKit, 320–1920px, light + dark) | Repo owner, 2026-09-27 |
| Accessibility floor (Generator, Chords, shared nav/footer) | **Tap targets ≥ 44×44px; no text below 12px** (tab art excepted, and it's hidden behind spoken note names); **small text ≥ 4.5:1** in both themes, fixed in the tokens: light `text-faint` #72675A / `text-faintest` #766B5B, dark `accent` #E85A42 / `text-faint` #9A8E7B / `text-faintest` #928573 / `text-on-accent` #140F0C (dark text on the red button), new `accent-on-ink` for red text on ink | `/next-phases` Phase 2, 2026-09-27 |
| Playback | Section and song playback play **exactly what the cards show**, so a locked section plays in the key and feel it was locked in. Progressions and sections loop; **Play song plays once**, top to bottom. Leaving a page stops playback | `/next-phases` Phase 2, 2026-09-27 |
| "Use in my song" and a locked Chorus | It's an explicit hand-off, so a locked Chorus takes the new key and progression too (and stays locked). Clicking a Power Chords row does **not** change a locked Chorus; the card offers "Update to …" instead | `/next-phases` Phase 2, 2026-09-27 |
| Power-chord engine | Voicing search + section recipes per `docs/power-chord-engine-brief.md`. Seed 0 reproduces the brief's hand-checked G paths (compact: chips; lifted: Chorus, with the octave added). **Repeated chords in a section always keep one voicing** (a hard rule, stricter than the brief's +3 penalty). Section boundaries use a soft pull toward the previous section's *zone*, not its actual last chord, so regenerating one section never changes another | `/next-phases` Phase 3, 2026-09-27 |
| Tabs in cards | Real bars (8 eighth-note cells), 2 per line, with chord names, P.M./let ring spans, accents and N.C. The Verse shows its 4 bars once, marked ×2, and plays them twice. Tabs are SVG text drawn at 12px that shrinks to fit the card, so they never scroll sideways; two-digit chorus tabs get small in the 5-column desktop row (see follow-ups). The old separate strum line (▼▲) is gone: the tab now shows the rhythm | `/next-phases` Phase 3, 2026-09-27 |
| Chips and progression playback | Chips (Chords page, Power Chords panel) show the engine's **library voicing**: compact 2-note shapes in the key's low/mid zone. Progression play buttons play those voicings with the feel's strum | `/next-phases` Phase 3, 2026-09-27 |

### Defaults for the next phases (owner can change any of these)

Set by the `/next-phases` routine on 2026-09-27; listed in each PR so the owner can overrule them.

| Question | Default |
|---|---|
| Chord library (engine brief §13.3) | Generate `data/chord-library.json` from the shape data. Chords-page chips show the voicing the engine picks for that progression |
| Pre-chorus / final-chorus lift (engine §13.4) | Not now: keep the 5 sections |
| Neck control (engine §13.5) | Automatic only; no Low/Mid/High control |
| 16th-note gallops (engine §13.6) | Off |
| Default intro style (melody §11.2) | Hook (Octaves and Harmony also available) |
| Lengths (melody §11.4) | Intro 4 bars, solo 8 bars (both selectable) |
| Technique notation (melody §11.5) | Standard: `b`, `r`, `h`, `p`, `/`, `\`, `~` |
| "Use in my song" (melody §11.6) | Replaces the Generator's Intro or Solo section (still lockable) |
| Feel on the Chords page (melody §11.7) | A full Feel control, sharing state with the Generator |
| Locked section after a key change | Keep "frozen once locked", but show "Locked in {key}" on the card, with a one-tap "Update to {new key}" action |
| Originality badge on the Generator | Replace "ORIGINALITY CHECK · PASS" with "CHORD PATTERNS ONLY · NO TABS STORED" |
| Audio when leaving a page | Stop playback when leaving the Generator or the Chords page |

## Notes on the owner calls

- **Dark mode:** the dark palette lives next to the light one in `tailwind.config.js` and is emitted
  as CSS variables (`:root` / `.dark`). The toggle stores an explicit choice in `localStorage`;
  with no stored choice it follows the OS `prefers-color-scheme`. The mockups have no dark
  designs, so the dark palette is an in-house interpretation of the tape-deck look — worth a
  design pass.
- **Solo variations:** seed 0 is still the template lick (`5,7,5,7` in A). Regenerating writes a
  6–7 note phrase from the key's major pentatonic within frets r-1…r+3 on the G/B/e strings,
  always ending on the root. See `leadLick` in `lib/generator.ts`.
