# PRD: Song Builder — set up a song, shape every section, take it away as a PDF or MIDI

Status: **owner's answers in (2026-09-30), ready to build** — see §11. Builds on Song Engine v2 (`docs/song-engine-v2-prd.md`) and absorbs its Phase 6 "Inputs" (R20–R22). Nothing here is built yet.

## 1. Summary

The Generator becomes a four-step builder:

1. **Key + Feel** — unchanged controls.
2. **Chords** — pick the song's progression from the key and feel, the same way the Chords page does (cards you can hear).
3. **Length** — a slider from **2:30 to 5:30**. The engine picks a form, section lengths and repeats that land on that time *at the feel's tempo*.
4. **Build** — every section appears as a **full-width card** (no columns), each with an expandable options panel (like a Chords-page card) for rhythm, playing style, voicing, drums and structure.

Then **Export**: a Palm/Mute-branded **PDF songbook** of the whole song's tabs, or a **MIDI file** whose tracks sit in the note ranges of the owner's lane table (§7).

## 2. Where things stand (facts)

| Area | Today | File |
|---|---|---|
| Controls | Key, Feel (5 feels; Mid-Tempo adjustable), GENERATE | `app/generator/page.tsx`, `components/FeelToggle.tsx` |
| Progression | 10 progressions; Chorus progression changes via GENERATE or a Power Chords row | `data/progressions.json`, `components/PowerChordsPanel.tsx` |
| Form | Short / Standard (with ending), no control; running-order strip + one card per part, 4-column desktop grid | `data/song-forms.json`, `components/FormStrip.tsx` |
| Grooves | 6 per section (Ending: 2), 8- or 16-cell bars, each with its own drums | `data/section-recipes.json` |
| Leads | Intro melody / Solo with style, length, take (the Chords page's expanded panel) | `components/ProgressionPanel.tsx`, `lib/melody.ts` |
| Song length | Standard form ≈ 73 bars: **~1:37 at 180 BPM, ~1:57 at 150, ~3:39 at 80** | computed from the data above |
| Critic | Best of 8 takes; ↻ changes only its own section | `lib/critic.ts` |
| Export | None | — |

Open work: PR #40 (Phase 5, solos that know the song) is merged. A follow-up (the Solo keeps the thread it was written with, so ↻ on the Intro or Chorus never rewrites it) sits uncommitted on the old `feature/leads-know-the-song` checkout in `context/GeneratorContext.tsx` and `e2e/critic.spec.ts`.

## 3. Goals and non-goals

**Goals**
- A songwriter can go from nothing to a complete, playable, full-length song in four decisions.
- Every section can be steered (rhythm, style, voicing, drums, bars) without leaving the card.
- The song leaves the app: a PDF a band can read off a music stand, and a MIDI file that drops straight into a DAW with parts already in sensible registers.

**Non-goals**
- No accounts, payments, cloud storage or saved songs (still a stateless client-side prototype). "Premium" means the *look and completeness* of the PDF, not a paywall (see Q4).
- No vocal melody *writing* (a vocal lane exists in the table, but lyrics/melody generation is out of scope unless the owner picks the full arrangement, Q3).
- No Guitar Pro / MusicXML export in this PRD (candidate follow-up).

## 4. User flow

```
[ Key ▾ ]  [ Feel: Fast Punk · Half-Time · Mid-Tempo · Pop Strum · Ballad ]
[ Chords:  I-V-vi-IV ▷ | I-IV-V ▷ | vi-IV-I-V ▷ | … ]        ← cards, hear before picking
[ Length:  2:30 ━━━━━━●━━━━━━━━━ 5:30 ]   3:15 · 146 bars at 180 BPM · Standard + bridge
[ BUILD SONG ]

Running order strip (sized by time, tap to play from there)

┌ INTRO ─────────────────────────────────────────── 4 bars · 0:00 ▷ ↻ 🔒 ⌄ ┐
│ full-width tab (2–4 bars per line, depending on width)                     │
│ ⌄ options panel (collapsed by default)                                     │
└────────────────────────────────────────────────────────────────────────────┘
┌ VERSE (plays 2×: 0:05, 1:12) ─────────────────── 8 bars ▷ ↻ 🔒 ⌄ ┐ …

[ Export PDF songbook ]  [ Export MIDI ]
```

Changing Key/Feel/Chords/Length after a build re-builds **unlocked** sections (locked ones stay frozen, as today). The length readout is live: section edits change it ("3:22 — 7 s over your 3:15").

## 5. Requirements

### 5.1 Setup (P0)

- **B1 Chords step.** The progression picker moves into the Generator's setup as playable cards (reuse `ProgressionRow`). Picking one sets the whole song's harmony (the harmonic plan already derives every section from it). *Option: see Q1 for per-section or free chord choice.*
- **B2 Length slider.** 2:30–5:30 in **15-second steps**, default **3:15**. Shows actual time, bar count, tempo and the form it chose.
- **B3 Length engine** (`lib/songLength.ts`, React-free). Given target seconds and tempo, choose from the forms and each section's allowed bar counts / repeats the plan closest to target, preferring (in order): musical forms (verse/chorus pairs intact, a chorus last), fewer weird lengths (4/8/16 bars), then the smallest error. Guaranteed within **± one bar of the chorus** of target. New forms in `data/song-forms.json`:
  - *Short* (no pre-chorus), *Standard* (today), *Standard + bridge*, *Extended* (3 verses or intro reprise, double solo, breakdown → bridge → last chorus ×2 → tag).
  - Worked check: 2:30 at 80 BPM needs ~50 bars (smaller than today's Standard: 4-bar verses, no pre-chorus); 5:30 at 180 BPM needs ~248 bars (Extended, 16-bar verses/choruses, double solo).
- **B4 Build** replaces GENERATE's label on this page (critic best-of-8 unchanged).

### 5.2 Full-width section cards (P0)

- **B5** One card per section, full width at every breakpoint, in running order of first appearance (as today). Tab wraps **2 bars per line on phones, 4 per line from tablet up** (8 on wide desktop was tried in the mock-up and dropped: frets shrink to ~7px). Each bar is drawn at its column's real pixel width, so tab text is **the same size at every width**; never scrolls sideways. Options panels start **collapsed**; the OPTIONS button shows the groove in use.
- **B6** Header: name, bars, every start time it plays at, ▷, ↻, lock, and an options toggle (`aria-expanded`, same pattern as the Chords page). One card's panel open at a time? **No** — several may be open (they're stacked, not a grid).
- **B7** Options panel per section (§6). Every change re-renders only that section, keeps the critic's checks (playability, mute plans, change speed), and shows a ▷ preview.

### 5.3 Exports (P0)

- **B8 PDF songbook** (§8).
- **B9 MIDI** (§7).
- Both are generated **in the browser on click**, from exactly what the cards show (locked sections included), with the song title as the filename (`never-say-goodnight-palm-mute.pdf`).

#### 5.4 Works on every screen (P0)

- **B12 Responsive.** The song builder must work and adapt at **320, 390, 834, 1024, 1280, 1440 and 1920px**, in **Chromium and WebKit**, **light and dark**. Checked in the mock-up (`docs/mockups/song-builder.html`) on 2026-09-30; the build must match it:

| | Phone (< 834) | Tablet (834–1279) | Desktop (≥ 1280) |
|---|---|---|---|
| Setup | Cards stacked; keys wrap; feels 3 + 2 | Cards stacked; feels in one row | Key + Feel side by side |
| Chords | Progression cards 2 per row | Auto-fill | 5 per row |
| Section card | Tools wrap under the title; takes read "3/4" | Title, plays-at chips and tools in one row | Same |
| Tab | 2 bars per line | 4 bars per line | 4 bars per line |
| Transport | One row, ~64px: play, part and time, loop, count-in, one speed button that cycles 100 → 90 → 75 → 50% | One row, ~68px, labelled buttons, speed segments; progress as a hairline on the top edge | Progress inline; shortcut hint (only on devices with hover) |

  Hard rules (asserted, not eyeballed): no sideways page scroll; nothing scrolls sideways inside a card; every control ≥ 44×44px; no text under 12px (tab art excepted, but tab text is constant size); nothing clipped; the page's bottom padding follows the transport's measured height so the last content is never hidden; a section's options panel and the export cards stay usable at 320px.

### 5.5 Folded in from v2 Phase 6 (P1)

- **B10 Difficulty** (Beginner / Intermediate / Advanced, default Intermediate) in the setup row — already decided in DECISIONS.md; it caps picking load and filters grooves.
- **B11 Style presets** (Skate punk / 2000s pop-punk / Emo) — decided; optional chip row above Key that pre-sets feel, grooves and form weights. *Can be deferred if the build runs long.*

## 6. What each section's options panel offers

The panel mirrors the Chords page's expansion: segmented controls with a ▷ on each choice, plus a "Take ↻" to try another take within the chosen options.

| Section | Rhythm (groove) | Playing style | Voicing / register | Structure | Drums / dynamics |
|---|---|---|---|---|---|
| **Intro** | Strummed (2) · Riffs (4: octave climb, low-string P.M., open-string pedal, hook in octaves) · Melody (lead styles) | Clean ring · Palm-muted · Octaves | Low / Mid | 2 · 4 · 8 bars | Guitar alone · Drum count-in · Full band |
| **Verse** | 6 grooves (sparse chugs, gallop, stop-time, offbeat accents…) | Palm-muted · Half-muted · Open | 2-note · 3-note | 4 · 8 · 16 bars; Verse 2: same · push · half-time · drop to guitar only | Hi-hat · Ride · Half-time |
| **Pre-chorus** | 6 builds (build to ring, climb, fill, stop-and-hit…) | Open ring · Accented | Climb register (stay · lift) | On / off · 2 · 4 bars; harmony: plan's climb or alternatives (e.g. IV-V, vi-IV-V) | Snare build · Stop · Tom fill |
| **Chorus** | 6 (let-ring with pushes, big hits, open gallop, anthem…) | Open ring · Driving eighths | 2-note · 3-note · Octave-doubled; lift above verse | 4 · 8 · 16 bars; Last chorus: double · key change up a tone · half-time drop then double | Crash every bar · Every 4 · Ride |
| **Solo** | Lead styles and takes (as Chords page) | Melodic · Hook quote · Shred (Advanced) | Neck position low / high | 4 · 8 · 16 bars · Over chorus / verse chords | Full band · Half-time |
| **Breakdown / Bridge** | 6 (heavy hits, dead-strum fills, gallop, chug and choke…) | P.M. · Stop-time · Guitar alone | Low | 4 · 8 bars · Build back in (bars) | Half-time · Floor toms · Silent |
| **Ending** | Final hit let ring · Stop on the one · **Chorus tag** · **Fade (repeat ×3)** (new) | — | — | 1 · 2 · 4 bars | Crash + choke · Ring out |

Rule: options are filtered by Difficulty and by what's playable at the tempo in that key (same gates as today, e.g. the pedal riff only with open-string roots). An option that isn't playable is shown disabled with a reason, not hidden.

## 7. MIDI export

**Format:** Standard MIDI File type 1, 480 PPQ, one track per part plus a conductor track (tempo, 4/4, key signature, and a **marker per section** — "Verse 1", "Chorus 2"…). Hand-written encoder (~150 lines, zero dependencies, byte-tested in verify).

**Lanes (from the owner's table).** Every exported note must fall inside its lane; notes outside are moved by whole octaves, never altered in pitch class. Verify asserts it. **Exception (owner, Q5): both guitar tracks export at concert pitch** (the notes the tab actually sounds), so guitar plug-ins play them where a guitar would; every other lane follows the table.

| Lane | Part | MIDI notes | Hz | Source in Palm/Mute | Scope (Q3) |
|---|---|---|---|---|---|
| Foundation | Sub | 24–38 | 33–73 | Song root on chord changes, long notes, chorus & breakdown only | Band + Full |
| Low end | Bass | 36–52 | 65–165 | Chord roots on the rhythm guitar's hits (P.M. = shorter), passing notes on pushes | Band + Full |
| Low mids | Piano left hand | 43–55 | 98–196 | Root-fifth on the chord changes | Full |
| Mid chords | Guitar rhythm | 52–67 | 165–390 | The tab's rhythm part, note-for-note, octave-lifted into the lane | **All** |
| Centre | Lead vocal | 57–76 | 220–660 | Guide melody: chorus/verse melody from the lead engine (placeholder for a singer) | Full |
| Upper mids | Piano right hand | 67–84 | 390–1050 | Triads in the chorus | Full |
| Upper mids / top | Pads / strings | 72–88 | 520–1320 | Sustained chord tones, chorus + last chorus | Full |
| Top (between vocal lines) | Guitar lead | 64–88 | 330–1320 | Intro melody / riff and Solo, note-for-note; with a vocal track, fills only in its gaps | **All** |
| Top | Synth leads, arps | 76–96 | 660–1760 | Arp of chord tones in the last chorus | Full |
| (not in table) | Drums | GM ch. 10 | — | The grooves' own drum patterns | Band + Full |

Why the guitar exception: real E-standard power chords sound at MIDI 40–64, so the 52–67 lane would put the rhythm guitar about an octave above concert pitch and guitar plug-ins would sound an octave high. The table's guitar ranges stay documented in `data/midi-lanes.json` as the *mix* lanes they occupy, and the full arrangement (Q3) voices the piano, pads, vocal and synth around the guitars' real register.

Velocities: accents 110, normal 92, palm-muted 78 and ~50% length, ghost/dead strums 40 (muted). Let-ring holds to the next hit.

## 8. PDF songbook ("premium" Palm/Mute branded)

- **Cover:** wordmark with the bolt, song title (split-flap style), key · feel · BPM · length · difficulty, the running-order strip, generated date.
- **Page 2 — Chart:** chord boxes for every power-chord shape used (the G5-style diagram already built), progression per section, form map with bar numbers and timestamps.
- **Section pages:** each section's full tab (all bars, 16th bars on their own line, P.M./let-ring spans, accents, N.C.), repeat marks and "Verse 2: adds a push" notes, mute plan and picking notes in small print.
- **Leads:** intro melody / solo tab with technique marks and a legend.
- **Brand:** tape-deck palette from the design tokens, Archivo Black / Space Grotesk / Space Mono embedded, header/footer with page numbers and "palm-mute" URL; always light theme; **A4** default with a US Letter option.
- **Engine:** vector PDF built client-side and lazy-loaded on click (Q4 picks the library), so it doesn't add to page load.

## 9. Data model changes

| File | Change |
|---|---|
| `data/song-forms.json` | + *Standard + bridge*, *Extended*; per-slot allowed bar counts and optional repeats for the length engine |
| `data/section-recipes.json` | Ending +2 grooves (tag, fade); style/voicing option tags per groove for the panel filters |
| `data/section-options.json` (new) | Which option groups each section shows, labels, defaults |
| `data/midi-lanes.json` (new) | The lane table above (single source for MIDI export and verify) |
| `data/pdf-layout.json` (new) | Page size, margins, bars per line, token references |
| `lib/songLength.ts`, `lib/midi.ts`, `lib/pdf.ts`, `lib/arrange.ts` (new, React-free) | Length engine, SMF writer, PDF layout, bass/sub/keys derivation |

## 10. Delivery plan (unattended run)

One branch and PR per phase, **stacked** (each branches from the previous, since nothing can merge while you're away). Each phase: build, lint, verify and the full Playwright suite must pass before its PR opens, **including the responsive gate (B12)**: `e2e/song-builder-responsive.spec.ts`, added in phase 1 and extended by every phase that adds UI, runs in all the existing Playwright projects (Chromium + WebKit, 320–1920, light + dark) and asserts B12's hard rules on whatever that phase built; DECISIONS.md, HOW-IT-WORKS.md and README numbers updated; screenshots at 390 / 834 / 1440 in the PR.

| # | Branch | Scope | Exit criteria |
|---|---|---|---|
| 0 | `fix/solo-keeps-its-thread` | Move the uncommitted Solo-thread follow-up onto a fresh branch from `main` and open its own PR (PR #40 is already merged) | e2e critic spec passes |
| 1 | `feature/song-builder-setup` | B1–B4, new forms, length engine | Every (feel × 2:30…5:30 step) lands within tolerance in verify; e2e drives the slider |
| 2 | `feature/full-width-sections` | B5–B7, §6 panels, new Ending grooves | Every option renders playable tabs in every feel (verify sweep); ↻ still changes only its own section; no sideways scroll 320–1920 |
| 3 | `feature/midi-export` | B9, lanes, drums, derived parts | SMF parses (round-trip test), every note in its lane, markers match form, length matches the card times |
| 4 | `feature/pdf-export` | B8 | PDF generated in e2e for 3 songs, page count sane, fonts embedded, text extractable |
| 5 | `feature/difficulty-presets` | B10–B11 | Presets/difficulty change output measurably (verify stats) |
| — | (after 7) `feature/responsive-sweep` | **Final responsive pass** over the finished builder: every B12 row checked by eye at 320 / 390 / 834 / 1024 / 1280 / 1440 / 1920 in both themes (all panels open, longest song, 16th-note bars, a locked section, playback running), fixes for anything found, before/after screenshots in the PR | B12 spec green in every project; screenshot grid in the PR |

Can't be done unattended: the guitarist review (§8.3 of the v2 PRD) and your pick from mock-ups — so the layout choices are asked now (§11) and each PR lists what you should play-test.

## 11. Owner's answers (2026-09-30)

| # | Question | Answer |
|---|---|---|
| 1 | Chords step | **One progression for the whole song**, picked from playable cards |
| 2 | Section panel contents | All five groups in §6 (default kept) |
| 3 | MIDI scope | **Full 9-lane arrangement** (+ GM drums): piano LH/RH, pads, vocal guide melody and synth arp are generated from the song's chords and lead engine |
| 4 | PDF engine | **jsPDF**, lazy-loaded on click (new dependency, approved) |
| 5 | MIDI pitch | **Concert pitch for the guitars**; every other lane follows the table |
| 6 | Other defaults | 15 s length step, A4 (+ Letter), several panels open at once, stacked PRs, presets & difficulty last (defaults kept) |

## 12. Premium upgrades (owner: no preference, so the recommended set, 2026-09-30)

In this build:
- **P1 Share links.** The whole song (key, feel, progression, length, difficulty, each section's seed, options and lock) encodes into the URL hash; **Copy link** reproduces it exactly. No backend: the engine is deterministic. Old links that fail to decode fall back to the default song with a notice.
- **P2 Takes history.** Each section keeps its last 8 takes: undo, and A/B any two before keeping one. Held in memory only.
- **P3 Transport bar.** A sticky tape-deck bar: play/stop, a cursor moving bar by bar through the tab, the section now playing, loop a section, count-in, **practice speed 50–100%**, shortcuts (Space play, R regenerate focused section, L lock).
- **P4 Songbook tabs.** Rhythm stems under the tab, bar numbers, repeat signs, chord boxes per section. **One renderer draws the screen and the PDF**, so they match.

Later, as its own phase: **real samples** (sampled guitar through an amp simulator, real drums, loaded after the page appears) and **WAV export**. It reverses the "synthesized, no sample pack" decision and adds download weight, so it needs its own yes.

Delivery: P4 lands with phase 2 (full-width sections, before PDF so the PDF reuses it); P3 and P1–P2 become phases **6** (`feature/transport-practice`) and **7** (`feature/share-and-takes`) after difficulty and presets.
