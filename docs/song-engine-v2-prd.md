# PRD: Song Engine v2 — the best pop-punk songs a guitarist can actually play

**Status:** Draft for owner review · **Written:** 2026-09-30 · **Scope:** the generation engine only (what gets written), not page design.

This document is self-contained: a new Claude Code session should be able to pick it up cold. Read `CLAUDE.md` (safety rules, one PR per phase, build + lint + verify + e2e before every PR), `DECISIONS.md` (owner calls that override defaults) and `docs/HOW-IT-WORKS.md` (the current engine) first.

---

## 1. Summary

Palm/Mute v1 writes five sections (Intro, Verse, Chorus, Solo, Breakdown) as real power-chord tabs, proves every note with `npm run verify` (222,000 combinations per build), and plays exactly what it shows. It is **correct**. It is not yet **great**: the song is five sections that don't talk to each other, three of them ignore the chosen progression, the rhythm vocabulary is thin, and "playable" is only checked note by note, not the way a guitarist experiences it (muting, picking hand, tempo, chord changes).

v2's goal: **every generated song is one a guitarist would want to play, can play at the stated tempo, and would recognise as a pop-punk song** — while keeping v1's guarantees (every note proven, audio = tab = text, deterministic seeds, no copied riffs, static site, data-driven).

## 2. Where v1 stands (facts, with file pointers)

| Area | v1 today | File |
|---|---|---|
| Sections | Intro 4 bars `I I IV IV`, Verse 4 bars ×2 `I I V V`, Chorus 4 bars = the chosen progression, Solo 8 bars (lead engine), Breakdown 4 bars `I I I I`, always half-time | `data/song-section-templates.json` |
| Progressions | 10 (I-V-vi-IV, vi-IV-I-V, I-IV-V, I-V-IV-V, vi-V-IV, IV-I-V-vi, I-vi-IV-V, I-IV-vi-V, V-vi-IV-I, I-V-IV); only the **Chorus** uses them | `data/progressions.json` |
| Feels | Fast Punk 180, Half-Time (180 click), Mid-Tempo 120–150, Pop Strum 150, Ballad 80 | `data/feels.json` |
| Rhythm | 8-cell bars (`D U x - .`), per section × variant × feel, P.M./ring per bar, accents, pushes, stop | `data/section-recipes.json` |
| Voicings | Shapes E2/A2/D2, E3/A3, inverted, open, octave; scored path search (position moves, common tones, zones, register, open bonus, D-root cost); chorus lifts 5 frets; never below the Verse | `lib/voicings.ts`, `data/engine-settings.json`, `data/voicing-shapes.json` |
| Leads | Intro melody + solo: pentatonic, hand positions per phrase, 2nd-order Viterbi, bends/legato/slides/vibrato, motif, arc | `lib/melody.ts`, `data/lead-rules.json`, `data/lead-rhythms.json` |
| Proof | Data layer, voicing engine (42,000 renders), lead engine (72,000 leads), reference tabs, audio = tab parsing | `scripts/verify-*.ts`, `scripts/fixtures/` |
| Audio | Tone.js synth guitar + drum templates per feel | `lib/audio/engine.ts`, `lib/playback.ts` |

### Known quirks (from the owner's review of real output)

Fixed on 2026-09-30 (`fix/playable-tabs`), now guarded by verify:
- Inverted power chords in the Breakdown (C5 as E3+A3 reads as a wrong G5).
- Open D-string root on ringing bars (D0+G2 let ring: nothing mutes the open low E and A).
- Octave shapes labelled as "E5" and strummed down-up across a muted string.

Still open (v2 should fix):
1. **Sections ignore the progression.** Verse is always `I I V V`, Intro `I I IV IV`, Breakdown `I I I I`. A vi-IV-I-V song still has an I-V verse.
2. **No song form.** Five sections played once; no second verse, pre-chorus, bridge, final chorus or ending. "Play song" is ~24 bars.
3. **Chord changes are only scored by fret distance**, not by time: a 7-fret jump on a pushed eighth at 180 BPM is as "cheap" as one on beat 1 of a slow bar.
4. **Playability is note-level.** No model of muting (which strings must be silenced and by what), picking-hand load (all-downstroke eighths at 180 for 8 bars), or open strings ringing into fretted chords.
5. **Rhythm vocabulary is small** (2–3 variants per section per feel); no gallops, no stop-time verses, no drum-and-guitar hits built together, no fills into the chorus.
6. **Intros are static.** The octave "riff" repeats one octave per chord; a real intro riff moves (root → 3rd → 5th, or the chorus melody in octaves).
7. **No song-level taste check.** Each section is scored alone; nobody checks that the chorus is the biggest moment, that energy builds, or that the intro sets up the chorus.
8. **Leads don't know the song.** The intro melody and the solo don't reuse each other's motifs or anticipate the chorus.

## 3. Goals and non-goals

**Goals**
- G1 **Playable at tempo:** every section passes a guitarist-realistic playability model at its feel's BPM, with a difficulty rating.
- G2 **One song, not five parts:** sections share a harmonic plan built from the chosen progression, with a real form and an ending.
- G3 **Sounds like the genre:** a richer, data-driven rhythm and riff vocabulary, with energy that builds to the chorus.
- G4 **Best of N:** generate several candidates and keep the best by a song-level critic (deterministic per seed).
- G5 **Keep every v1 guarantee:** proofs, audio = tab = text, determinism, originality (patterns only, never stored tabs), static and client-side, data-driven tuning.

**Non-goals (v2)**
- Vocals, lyrics or topline melodies (maybe v3).
- Other tunings (Drop D, Eb) — design the data model so they are possible later, but don't ship them.
- Sample-based audio, DAW export, accounts, saving/sharing.
- "Sound like <band>" presets (originality risk); style presets describe eras/techniques, never artists.

## 4. Users and the bar for "great"

- **The player** (beginner → intermediate guitarist): wants something that sounds like a real pop-punk song and that their hands can do. Success: they can play every section at tempo after a few tries, and they'd keep the song.
- **The writer:** wants a starting point with a strong chorus to build on. Success: the chorus is the hook; the rest sets it up.

A generated song is "great" when a guitarist reviewer answers yes to: *Is it playable at tempo? Does every chord read as what it says? Does the chorus lift? Would you keep this?* (see §8).

## 5. Principles (unchanged from v1, restated as constraints)

1. **Prove, don't hope.** Every new rule is either a hard constraint enforced in the search *and* asserted in verify, or a soft cost with a measured distribution reported by verify.
2. **Data over code.** New vocabulary (forms, rhythms, riffs, style presets, weights) lives in `data/*.json`; code stays generic.
3. **One set of events.** Tab, audio and screen-reader text keep coming from the same bar events.
4. **Deterministic.** Same inputs + seed → same song. Seed 0 = the engine's best take.
5. **Guitarist review decides.** Reference outputs are hand-checked; the owner's review of real tabs overrides a metric.

## 6. Requirements

Priorities: **P0** must ship in v2 · **P1** should · **P2** nice to have. Each item lists its acceptance check (verify = `npm run verify`; e2e = Playwright).

### 6.1 Playability model (P0)

- **R1 Muting model.** For every chord hit, compute which of the six strings sound, which are fretted, and which must be muted and *how* (fretting-finger underside, fretting-finger tip, thumb, palm). Reject shapes whose required mutes are impossible for the strum type (e.g. open strings on both sides of an open 2-note shape when strummed; open strings under a fretted shape with no muting finger). *Verify:* every ringing hit has a feasible mute plan; report mute-plan counts.
- **R2 Tempo-aware changes.** Score each chord change by *time available* (cells between the last hit of chord A and the first of chord B, at the feel's BPM) × *difficulty of the move* (frets moved, string-set change, shape change, open→fretted). Pushes count as the eighth they land on. Hard limit: no change needs more than N frets per 100 ms (tunable). *Verify:* max change speed per feel; zero over the limit.
- **R3 Picking-hand load.** Model downstroke-only runs (e.g. 8 bars of all-down eighths at 180 BPM) and skip-string octave picking. Cap sustained all-down eighths per feel; above the cap, alternate or add rests. *Verify:* report longest all-down run per feel.
- **R4 Difficulty rating.** Each section and song gets a 1–5 rating from R1–R3 plus stretch and position. Exposed as data (and later UI). P1: a **Difficulty** input (Beginner / Intermediate / Advanced) that constrains shapes (e.g. Beginner: 2-note + open only, max move 3, no pushes at 180).
- **R5 Label honesty.** A chord's label always matches its notes (power chord = root + fifth ± octave; "oct" for octaves; any future add9/sus named as such). *Verify:* label ↔ pitch-class set, every render (extends the 2026-09-30 check).

### 6.2 Harmonic plan and song form (P0)

- **R6 Progression-aware sections.** The chosen progression drives the whole song through **section harmony rules** in data, e.g. Verse = the progression's first half repeated or a related loop (same chords, different order/rhythm, or a sparser 2-chord reduction); Intro = the chorus progression or its first two chords; Breakdown = the progression's darkest two chords (e.g. vi–IV) or the tonic pedal; Pre-chorus = a IV–V (or ii–V) climb that sets up the chorus's first chord. *Verify:* every section's degrees come from the plan; each plan is a pure function of (progression, form, seed).
- **R7 Song forms.** A form library in data (e.g. `Short`: I-V-C-V-C-Solo-Bd-C-End; `Standard`: Intro-V1-Pre-C-V2-Pre-C-Bridge/Solo-Bd-C-C-End). Repeated sections reuse their material with a controlled variation (second verse adds a push; last chorus doubles or goes up). *Verify:* every form renders; repeats are identical except the declared variation.
- **R8 Energy arc.** Each section has an energy target (register, density, P.M. vs ring, 2- vs 3-note, drum template). The chorus is the song's peak; the last chorus ≥ the first. *Verify:* energy(chorus) > energy(verse) for every song; report the arc.
- **R9 Endings.** A real ending: final chord let ring, a stop on the last "1", or a tag (last line ×3). P1.
- **R10 Key change (P2).** Optional last-chorus lift (+1 or +2 semitones) using the same shapes moved up, within the fret limit.

### 6.3 Rhythm and riff vocabulary (P1)

- **R11 More grooves per feel,** tagged by section role and energy (e.g. verse-sparse, verse-drive, chorus-open, chorus-big, pre-build, breakdown-stop). Target ≥ 6 per role per feel. Includes **gallops** (needs 16-cell bars: see R14), **stop-time** verses, **accent hits** shared with drums, and **fills** in the last bar before a chorus.
- **R12 Moving intro riffs.** Octave riffs that move (root–3rd–5th–octave of the key, or the chorus's lead motif in octaves), single-note palm-muted riffs on the low strings, and open-string pedal riffs (fretted notes against an open E/A). Proven like leads: scale, playability, audio = tab.
- **R13 Guitar–drum lock.** Drum templates and guitar rhythms chosen together from a shared groove id, so kicks land with accents and stops are full-band. *Verify:* every stop silences both; accents align with kick/snare within the groove's rules.
- **R14 16th-note grid.** Extend bar events, tab rendering and verify to 16 cells where a groove needs it (gallops, fills). The owner deferred 16ths in v1 (DECISIONS.md); this is the moment to decide.

### 6.4 Leads that know the song (P1)

- **R15 Motif thread.** The intro melody states a motif that returns in the solo (transformed: up an octave, rhythmic displacement). *Verify:* motif reuse detected in ≥ 1 solo phrase for every song.
- **R16 Solo over the song's own chords,** i.e. over the Verse or Chorus plan (not only the chosen progression), with the peak landing on the section's strongest chord.

### 6.5 Best-of-N and the song critic (P0)

- **R17 Song critic.** A scoring function over a whole song: playability (R1–R4), coherence (R6–R8), variety (not the same voicing/rhythm in every section), hook strength (chorus register lift, 3-note shapes, rhythmic contrast with the verse), and ear checks (no clashing open strings, no unresolved endings). Weights in `data/critic.json`.
- **R18 Generate N, keep the best.** For each seed, generate N candidates from derived sub-seeds and keep the critic's best. Deterministic. N tuned so Generate stays under ~100 ms on a mid-range phone.
- **R19 Reproducible regenerate.** "Regenerate section" re-runs only that section's candidates against the song's plan; locked sections stay frozen (v1 behaviour).

### 6.6 Inputs and presets (P1)

- **R20 Style presets** (data only): e.g. *Skate punk* (fast, P.M. verses, gallops), *2000s pop-punk* (Pop Strum/Fast Punk, big 3-note choruses, pushes), *Emo* (Mid-Tempo/Ballad, open-string pedal riffs, vi-first progressions). Each preset = weights + allowed grooves + form + feel defaults. Names describe eras and techniques, never artists.
- **R21 Difficulty** input (R4).
- **R22 Song length** (Short / Standard) = form choice (R7).

## 7. Data model changes (proposed)

| File | Change |
|---|---|
| `data/song-forms.json` (new) | Forms: ordered section roles, repeats, variations, ending. |
| `data/section-harmony.json` (new) | Rules mapping (progression, role) → degree sequence; replaces fixed `degreeSequence` in `song-section-templates.json`. |
| `data/grooves.json` (new, or extend `section-recipes.json`) | Groove id → guitar cells (8 or 16), articulation, accents, pushes, stops, **and** its drum pattern, role and energy tags per feel. |
| `data/riffs.json` (new) | Intro riff templates (octave paths, low-string single-note figures, pedal riffs) as scale-degree patterns. |
| `data/playability.json` (new) | Mute rules, change-speed limits per feel, picking-load caps, difficulty bands. |
| `data/critic.json` (new) | Song-critic weights and thresholds. |
| `data/style-presets.json` (new) | Presets → weights, grooves, forms, feels. |
| `data/engine-settings.json` | Keep; add difficulty-band overrides. |

Keep: `progressions.json`, `feels.json`, `voicing-shapes.json`, `lead-*.json`. All new files must be loaded through `lib/` modules that stay free of React so verify can sweep them.

## 8. Evaluation

1. **Verify (every build):** all v1 invariants + R1, R2, R5, R6, R7, R8, R13 as hard checks; distributions for R3, R4, R17 printed in the summary. Keep runtime ≤ ~2 minutes (sample seeds if the product grows too large; document the sampling).
2. **Reference songs:** 10–15 hand-checked whole songs at seed 0 (spread across keys, feels, progressions, forms), stored as fixtures and diffed like today's reference tabs.
3. **Guitarist review protocol:** before each phase merges, the owner (or a guitarist tester) plays 10 generated songs picked by a fixed seed list and scores each on the four questions in §4 (1–5). Target: median ≥ 4 on every question; zero "a chord reads wrong". Results go in the PR.
4. **Regression guard:** a fixed "hall of shame" list of every tab the owner has flagged (starting with the three from 2026-09-30) that must never reappear.

## 9. Delivery plan (one PR each, per `CLAUDE.md`)

| Phase | Scope | Exit criteria |
|---|---|---|
| 1 Playability model | R1–R3, R5 (+ R4 rating, no UI) | Verify enforces mute plans and change speed; hall-of-shame passes; no reference tab gets harder |
| 2 Harmonic plan + forms | R6–R9 | Every section follows the plan; Standard form renders; Play song plays the form |
| 3 Best-of-N critic | R17–R19 | Critic scores reported; guitarist review median ≥ 4 |
| 4 Grooves + riffs | R11–R13 (+ R14 if approved) | ≥ 6 grooves per role per feel; moving intro riffs proven |
| 5 Leads that know the song | R15–R16 | Motif thread in every song |
| 6 Inputs | R20–R22 (+ R4 UI, R10) | Presets and difficulty change output measurably; e2e covers the controls |

Each phase: mock-up or listening page first where the change is audible (`docs/mockups/`), owner picks, then build; update `docs/HOW-IT-WORKS.md`, `DECISIONS.md` and the README numbers.

## 10. Open decisions for the owner (recommended defaults in **bold**)

1. Song form default: **Standard with an ending** / Short / keep today's five sections.
2. Verse harmony: **the progression's own chords in a sparser rhythm** / a related loop (different order) / keep `I I V V`.
3. 16th-note grid for gallops and fills: **yes, in Phase 4** / not in v2.
4. Difficulty input: **yes, default Intermediate** / rating only, no input.
5. Best-of-N size: **N = 8** (tune for phone speed) / other.
6. Style presets: **three (Skate punk, 2000s pop-punk, Emo)** / none in v2.
7. Last-chorus key change: **off by default, available in presets** / never.
8. Open D5 as the 3-note `x-x-0-2-3` shape (currently excluded by the "standard shapes only" rule because its octave sits on the B string): **allow for open-key intros and ringing chords only** / keep excluded.

## 11. Risks

- **Search cost:** best-of-N × song-level plans on a phone. Mitigate: cache voicing paths per (key, chord set, zone); budget N by device; keep each section's search bounded as today.
- **Verify runtime** grows with forms × grooves. Mitigate: exhaustive where cheap, seeded sampling elsewhere, always the hall-of-shame and references.
- **Taste drift:** metrics can reward the wrong thing. Mitigate: guitarist review gates each phase; owner calls go in `DECISIONS.md`.
- **UI knock-on:** longer songs and new sections affect the Generator layout (five cards today). Coordinate with a design pass; the engine should expose the form so the UI can adapt (e.g. show unique sections, play the full form).

## 12. Appendix: glossary

- **Power chord:** root + fifth (± octave). Named "C5".
- **Inverted power chord:** fifth under the root (e.g. G under C). Not used in rhythm parts since 2026-09-30.
- **Octave shape:** root + root an octave up across a muted string. Named "C oct".
- **P.M.:** palm mute. **Let ring:** notes sustain until the next hit.
- **Push:** the next chord arrives an eighth early. **Stop:** the whole band cuts out.
- **Zone / register / lift:** where on the neck a section sits; the chorus lifts above the verse.
