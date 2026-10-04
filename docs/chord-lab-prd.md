# PRD: Chord Lab — look chords up, find them on the neck, build and move progressions

Status: **agreed** (2026-10-04). The Lab replaces today's Chords page at `/chords/` and is independent of the Song Generator. The mock-up is `docs/mockups/chord-lab.html` (build option C); the owner's answers are in §10.

## 1. Summary

The **Chord Lab** is a guitarist's toolbox for chords, separate from song writing. It has six tools:

1. **Dictionary** — every chord a pop-punk guitarist uses, beyond power chords: diagrams, every playable position, ▷ to hear it.
2. **Name that chord** — tap frets on a neck; it names the chord and the keys it belongs to.
3. **Fretboard** — one chord, everywhere on the neck, by shape.
4. **Progression builder** — tap chords from a key into a loop, hear it, get "what next?" suggestions and a vibe rating.
5. **Key finder & transposer** — type chords, get the key and numerals; move them to another key, a capo, or another tuning.
6. **Mood map** — progressions plotted dark↔bright and settled↔restless; tap anywhere to hear what lives there.

It looks and behaves like the Song Generator (same header, guide posters, control cards, full-width cards, tokens, tabs and audio), but **nothing in it reads from or writes to the Generator**: no "use in my song", its own key, tuning and playback.

## 2. Where things stand

| Area | Today | File |
|---|---|---|
| Chord shapes | Power chords only: 2- and 3-note on E/A/D roots, octaves, inverted (`data/voicing-shapes.json`) | `lib/voicings.ts` |
| Tuning | E standard only (`OPEN_STRING_MIDI`) | `lib/musicTheory.ts`, `lib/fretboard.ts` |
| Theory | Major keys; degrees I–vii; 10 progressions with brightness | `data/progressions.json`, `lib/musicTheory.ts` |
| Audio | Synth guitar: strums any MIDI notes, single plucks, drums, feels | `lib/audio/engine.ts`, `lib/playback.ts` |
| Pages | Count In, Generator, Chords (the Chords page sends to the Generator) | `app/` |
| Drawing | Chord chips (mini tabs), chord boxes (in the PDF), songbook tabs | `components/ChordChip.tsx`, `lib/songbook.ts` |

## 3. Goals and non-goals

**Goals**
- A player can **find any chord**, **name any shape**, **see the whole neck**, **build a loop**, **work out a key** and **move it** without leaving one page.
- Every diagram is **correct by construction** and checked by `npm run verify` (right notes, playable stretch, named honestly).
- It feels like part of Palm/Mute: the same visual system, guide, tabs, sound and responsive rules (the B12 gate).

**Non-goals**
- No link to the Generator (no hand-off either way). If the owner wants one later, it's a separate decision.
- No accounts or saved libraries. One optional per-browser convenience (the last key/tuning) at most.
- Not a full jazz dictionary: chord types stop at what pop-punk uses (§5.1).
- No microphone chord detection (the browser frame blocks the mic in artifacts and it's out of scope here).

## 4. Page structure (common to every layout option)

```
SONGWRITING TOOLS                                        [badge]
CHORD LAB
[ guide: 4 Setlist posters — Look up · Name it · Build · Move it ]

[ Lab setup: Key ▾ | Tuning: E std · E♭ std · Drop D · Drop C# | Handed: right/left ]

[ tools — the layout option decides how they're arranged (§9) ]
```

- **Lab setup** is shared by every tool: the key (for numerals, the builder's palette and the mood map) and the **tuning** (every diagram, fret number and sound follows it). Left-handed mirrors every diagram and neck (cheap, and real players ask for it).
- Each tool is a full-width card in the Generator's style (number, title, ▷, options), with its own state.

## 5. Requirements

### 5.1 Dictionary (P0)

- **L1 Chord types** (data, `data/chord-types.json`): `5` (power), `oct`, `maj`, `min`, `sus2`, `sus4`, `add9`, `7`, `maj7`, `m7`. Each type = intervals + symbol + one-line "sounds like" note.
- **L2 Positions**: for a root + type, every playable voicing up to fret 15: **open shapes** (curated, `data/open-chords.json`), **moveable barre shapes** (E-shape, A-shape, D-shape templates) and **partial shapes** (power, octave, top-string triads). Ranked by difficulty (stretch, barre, muted strings).
- **L3 Each voicing card**: chord box (strings, frets, fingers, ×/○, barre line), the notes and intervals it plays (R, 3, 5…), fret range, difficulty (1–5), ▷ strum and ▷ arpeggio.
- **L4 Filters**: type, "easy only", "no barres", position (open / low / mid / high).
- **Rule**: every voicing plays exactly the chord's tones (root present; 5th may be omitted only in 7th chords; no extra notes), stretch ≤ 4 frets (5 for add9 with a note on the 1st fret excluded), strings between played strings either fretted or muted by a named technique (reuse R1 mute model).

### 5.2 Name that chord (P0)

- **L5** Tap frets on a 6-string neck (0–15, × to mute a string); the chord is named live: best name first ("Gsus4"), alternatives ("Csus2/G"), slash chords for inversions, "not a chord" for a single note or clashes.
- **L6** Shows the **keys it belongs to** (as I, IV, V, ii…) and a ▷.
- **L7** "Snap to dictionary": if the shape matches a dictionary voicing, show its card; if it's almost one (one fret off), suggest the fix.

### 5.3 Fretboard explorer (P0)

- **L8** A full neck (0–15 frets, inlays at 3/5/7/9/12/15) showing a chord's tones everywhere, coloured by role (root red, 3rd brass, 5th ink, others faint).
- **L9** Overlay a chosen voicing's shape; step through every position (‹ ›) and hear each.
- **L10** Toggle "show the scale" (the key's major scale, pentatonic) behind the chord tones.
- Phones (< 640px): the neck stands upright (low string on the left, like a chord box; mirrored for left-handed), all 15 frets, ~44px per fret and string so Name it is tappable and labels stay ≥ 12px. No scrolling inside the card (B12).

### 5.4 Progression builder (P1)

- **L11 Palette** from the setup key: I ii iii IV V vi vii° plus **borrowed** ♭III ♭VI ♭VII iv (pop-punk loves ♭VII and iv). Each chip as 5 / maj / min / sus.
- **L12 Loop**: up to 8 chords, drag to reorder, tap to change type, ▷ plays the loop in a feel (Fast Punk… Ballad) with its strum; loop on.
- **L13 What next?**: the 3 most likely next chords (data, `data/chord-moves.json`, from the 10 progressions and common pop-punk moves), each with ▷.
- **L14 Vibe**: brightness (dark ↔ bright, from the degrees), restlessness (how unresolved the loop ends), and "classic-ness" (how close to the genre's common loops), as three small meters with a one-line reason.
- **L15** Send to **Key finder** or **Fretboard** in the Lab (internal links only).

### 5.5 Key finder & transposer (P1)

- **L16** Type or tap 2–8 chord names ("G D Em C"); the Lab lists the keys they fit (major and relative minor), best first, with numerals, and flags chords outside the key as borrowed.
- **L17 Transpose**: up/down by semitones, to a named key, or **for a capo** (shows the shapes to play with the capo at fret n, e.g. "capo 2: play G shapes to sound A").
- **L18 Tunings** (data, `data/tunings.json`): E standard, E♭ standard, Drop D, Drop C#. Diagrams and fret numbers change; the sound changes; Drop tunings show one-finger power chords on the low strings.

### 5.6 Mood map (P2)

- **L19** A 2D map: x = dark ↔ bright, y = settled ↔ restless. Dots are progressions (the app's 10, plus ~20 more common loops in `data/mood-map.json`), labelled by numerals and chords in the setup key.
- **L20** Tap a dot to hear it; tap empty space to hear the nearest; the builder's loop shows as a ★.
- **L21** Layout: the map (quadrants Tense / Anthem / Brooding / Feel-good) beside a panel for the picked loop (its chords in the key, two meters, ▷, and a list of every loop as chips); the panel drops below the map under 1024px. On narrow maps only the picked dot is labelled and the chip list does the naming; dots are 44px tap targets.

## 6. What it looks like (shared rules)

- Tokens, type and components from the Song Generator (`tailwind.config.js`, `PageHeader`, `PageGuide`, `ControlCard`, `SegmentedControl`, full-width cards, chord chips, the tab renderer).
- **Chord box** component (new, shared by Dictionary, Name it and the PDF songbook): six strings, four or five frets, start fret, ×/○, dots with optional finger numbers, barre line. One renderer, so screen and PDF match.
- **Neck** component (new): horizontal from tablet up; on phones the layout option decides (§9).
- Audio: the app's synth guitar; ▷ on everything, one thing playing at a time; leaving the page stops it.
- Accessibility: every diagram has a text alternative ("G major, open: E string 3rd fret, A string 2nd fret…"), tap targets ≥ 44px, text ≥ 12px.

## 7. Data and code

| File | What |
|---|---|
| `data/chord-types.json` | Types: intervals, symbol, "sounds like" |
| `data/open-chords.json` | Curated open voicings (fingering included) |
| `data/chord-templates.json` | Moveable shapes (E/A/D-shape barres, partials) as intervals per string |
| `data/tunings.json` | Open-string MIDI notes per tuning |
| `data/chord-moves.json` | Next-chord weights by degree (builder) |
| `data/mood-map.json` | Extra progressions for the map, with scores |
| `lib/lab/chords.ts` | Voicings for root + type + tuning; naming a shape; difficulty |
| `lib/lab/keys.ts` | Key finding, transposing, capo maths, borrowed chords |
| `lib/lab/mood.ts` | Brightness, restlessness, classic-ness |
| `app/chords/page.tsx` (renamed Chord Lab), `components/lab/*` | The page and its tools; today's Chords page and its send-to-Generator hand-off are removed |

All `lib/lab/*` is pure (no React), so verify can sweep it.

## 8. Evaluation

- **Verify (new suite `verify-lab`)**: every dictionary voicing in every tuning and root plays exactly its chord tones, within stretch and fret limits, with a mute plan for every skipped string; **naming round-trips** (every voicing names back to its own chord); key finder finds the right key for all 10 progressions in all 12 keys; transposing up and back is identity; capo maths agree with the tuning maths.
- **Browser tests**: each tool's main path, audio = diagram, and the B12 responsive gate extended to `/lab/`.
- **Guitarist check** (owner): 10 chords looked up, 5 shapes named, 2 loops built — anything that reads wrong goes on a "hall of shame" list verify keeps out.

## 9. Layout options (see the mock-up)

| Option | Idea | Good for |
|---|---|---|
| **A · Tabs** | One tool at a time under the shared setup, six tabs | Focus; phones; simplest to build |
| **B · Workbench** | A big "chord on the bench" panel (box, neck, sound) on the left; tools on the right feed it (Dictionary picks it, Name it detects it, Builder sends it) | Feels like one instrument; desktop |
| **C · Long page of tool cards** | Every tool as a full-width card, like the Generator's sections, with a strip of tool chips at the top to jump | Matches the Generator most closely; scannable |

Phones: one column; the neck stands upright (§5.3).

## 10. Owner's answers (2026-10-04)

1. **Page**: rename Chords to the Chord Lab: keep `/chords/`, menu label "Chord Lab", drop the send-to-Generator hand-off (and its tests).
2. **Layout**: **C · Long page**: five stacked full-width cards (Dictionary, Name that chord, Progression builder, Key finder & transposer, Mood map) with the jump strip. The Fretboard explorer (§5.3) lives inside the Dictionary card, under the voicings, rather than as its own card.
3. **Chord types**: the full list.
4. **Tunings**: E std, E♭ std, Drop D, Drop C♯.
5. **Left-handed**: yes (default, not raised).
6. **Build order**: the default below (not raised); PR 1 is the Dictionary card with its fretboard.

7. **Today's progression library** (the old Chords page: 10 progressions, sort, play, intros/solos, send to Generator): **dropped**, with its tests. The Count In links, menu, sitemap and README point at the Lab.
8. **Playback**: **one fixed feel**: every ▷ in the Lab (strum, loop, mood map) plays at 150 BPM with an eighth-note strum. No feel or tempo control on the page.
9. **Unattended build**: **6 stacked PRs** (docs + Dictionary with its neck → Name it → Builder → Key finder & transpose + tunings → Mood map → device sweep, README and guide). If a check fails and can't be fixed after a proper attempt, that PR opens **flagged as failing** with the output, and the chain carries on.
10. Defaults taken without asking: the guide shows once per browser (its own storage key); key and tuning aren't remembered; the open-chord shapes and extra mood-map loops are authored by Claude and gated by `verify-lab`; the owner's guitarist check comes after the build.

### The questions as asked (defaults in bold)

1. **Page**: **a new page beside Chords (`/lab/`, "Chord Lab" in the menu)** / replace today's Chords page / rename Chords to the Lab and drop the Generator hand-off.
2. **Layout**: A Tabs / **B Workbench** / C Long page.
3. **Chord types**: **5, oct, maj, min, sus2, sus4, add9, 7, maj7, m7** / fewer (drop the 7ths) / more.
4. **Tunings**: **E std, E♭ std, Drop D, Drop C#** / add Drop B, D standard.
5. **Left-handed mode**: **yes** / no.
6. **Build order** (one PR each, stacked, as before): **1 Dictionary + Fretboard → 2 Name it → 3 Builder → 4 Key & transpose + tunings → 5 Mood map → responsive sweep**.
