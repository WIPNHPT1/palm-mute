# Palm/Mute: Intro Melody and Lead Solo Generator (brief for a new Claude Code session)

**How to use this file:** start a new Claude Code session in the `palm-mute` repo and say "read `docs/melody-and-solo-brief.md` and follow it", or run `/next-phases`, which builds it as Phase 4. Claude should **explain its understanding and plan first, settle the open decisions in section 11 with the owner, build a mock-up to approve, and only then build into the site**, following `CLAUDE.md`.

**Related:** `docs/power-chord-engine-brief.md` covers the expert power-chord engine (voicings up to the 12th fret, section recipes, bar-by-bar tabs). This feature shares its fretboard maths, tab format, rules approach and tests. **Build the power-chord engine first, or at least its shared fretboard and tab modules**, so the two don't diverge.

---

## 1. What we're building

On the **Chords page** (`/chords/`), picking a key and a progression lets you generate, for that exact key and progression:
1. **An intro melody:** a short, catchy lead hook of 4 or 8 bars.
2. **A lead guitar solo:** 8 or 16 bars that build, peak and resolve.

Each one shows as a playable **tab**, can be **played along with the chords and drums**, **regenerated** for a new take, **copied** as text, and **sent to the Generator** to become that song's Intro or Solo.

## 2. Where things stand today

- The Chords page lists 6 progressions per key as cards (`app/chords/page.tsx`, `components/ProgressionRow.tsx`), each with chord chips and a play button. **Clicking a card does nothing, and there's no way to use a progression elsewhere.** See the audit notes in section 10.
- The Generator's **Solo** section today is a 4-to-7 note major-pentatonic lick on the G, B and e strings, anchored at the key's root fret on the low E string (`leadLick` and `pentatonicBox` in `lib/generator.ts`). This feature replaces it with the new solo engine, so both pages share one implementation.
- Data lives in `data/*.json` (the single source of truth); pure logic lives in `lib/`, with no React. Audio uses Tone.js in `lib/audio/engine.ts`: synthesized, one shared Transport, feels from `data/feels.json`.

## 3. Music rules (the part that makes it sound good)

**Scales**
- **Default: the key's major pentatonic** (1, 2, 3, 5, 6). In G that's G A B D E. It uses the same notes as the relative minor pentatonic (E minor pentatonic in G), which is the classic pop-punk lead sound and can't clash with the chords.
- **Optional colour, per style:** the full major scale (adds 4 and 7) for melodic intros, used only as passing notes on weak beats. Also a "blue" note (flat 3 bent up to 3) for solos.

**Fitting the chords**
- **Chord tones:** a power chord has only a root and fifth, but the melody decides major or minor. On I, IV and V use the major third; on vi (and ii and iii) use the minor third. The third is a strong, emotional note.
- **Strong beats** (the 1st, 3rd, 5th and 7th eighth-note of a bar): prefer a note of the chord playing at that moment (root, 3rd or 5th). Aim for at least 75% chord notes on strong beats.
- **Weak beats:** notes one scale step away (passing and neighbour notes) connect the chord notes.
- **Pushes:** if the next chord arrives early (a pushed chord from the power-chord engine), the melody targets the new chord's notes early too.

**Shape of the line**
- **Mostly stepwise.** Leaps of up to a fifth, followed by a step back in the opposite direction.
- **Motifs:** state a 1- or 2-bar idea, then repeat or vary it by moving it to the next chord's notes or changing its ending. Use call and response: bars 1 and 2 ask, bars 3 and 4 answer.
- **Range:** the intro stays within about an octave, and the solo within two. The solo climbs over its length.
- **Endings:** the last note is the root (or the 3rd) on a strong beat, held.

**Techniques (mainly the solo)**
- **Bends:** a whole step (2 frets) or half step, **only from a scale note to a scale note**. In G: bending A up to B, or D up to E. Bending B on the G string to C# is wrong because C# isn't in the key, and the rules must reject it.
- Also: release, slides (`/`, `\`), hammer-ons and pull-offs (`h`, `p`), vibrato (`~`) on long notes, a repeated-note (tremolo) run for intensity, and double-stops.
- **The solo's arc across 8 bars:** bars 1–2 low and sparse (motif), bars 3–4 answer higher, bars 5–6 busier with a position shift, bar 7 the peak (bend and hold with vibrato), bar 8 resolves to the root.

**Intro styles** (the owner picks the default)
- **Hook:** single notes.
- **Octaves:** each note doubled an octave up, skipping a string. It's the signature pop-punk lead sound.
- **Harmony:** double-stops in diatonic thirds or sixths.

**Fretboard**
- Notes are placed on strings and frets by a fingering search: stay inside one 4-fret hand position (a pentatonic "box") where possible, shift position only between phrases, and never go above fret 12. That limit is shared with the power-chord engine config; ask if the solo may reach 15.
- **String maths:** open-string MIDI is E2=40, A2=45, D3=50, G3=55, B3=59, e4=64, and a note's pitch is `open[string] + fret`. **The B string is 4 semitones above G** (every other adjacent pair is 5), so shapes shift one fret up when they cross from G to B.

## 4. Worked example (every note checked with code)

**Key of G, I-V-vi-IV (G5, D5, E5, C5), intro "Hook" style, 8th notes, B and e strings.** Notes: G A B D E only. Strong-beat chord notes: 14 of 16. It ends on the root, G.

```
  G5               D5               E5               C5
e|----3---3-5-7---|5---3-------5---|7-5-3-------3---|3-----------3---|
B|3-5-------------|------5-3-------|--------5-------|--5-3---5-------|
G|----------------|----------------|----------------|----------------|
D|----------------|----------------|----------------|----------------|
A|----------------|----------------|----------------|----------------|
E|----------------|----------------|----------------|----------------|
```
Note names, bar by bar (`·` = hold): G: D E G · G A B · | D: A · G E D · A · | Em: B A G · E · G · | C: G E D · E · G ·

**Bend check in G:** `e|5b7` (A to B) ✓, `B|3b5` (D to E) ✓, `G|4b6` (B to C#) ✗ must be rejected.

## 5. How the generator works (same approach as the power-chord engine)

1. **Inputs:** key, progression id, feel and tempo, part (`intro` | `solo`), style, length (bars), seed, fret limit.
2. **Rhythm first:** choose rhythm cells per bar from `data/lead-rhythms.json`: 8ths, dotted-8th plus 16th, syncopated pushes, held notes at phrase ends, 16th runs for the solo peak. The number of notes per bar follows the arc (sparse, then busy, then held).
3. **Then pitches:** for each note slot, the candidates are the scale notes in range. Choose the sequence with the lowest total cost using the Viterbi algorithm or a beam search. The cost rewards chord notes on strong beats, step motion, repeating the motif, the planned register arc and the ending on the root. It penalises out-of-scale notes (hard rule), unresolved leaps, the 4th scale degree on strong beats over I, and range violations. **All weights live in `data/lead-rules.json`.**
4. **Techniques:** place bends, slides, hammer-ons, pull-offs and vibrato where the rules allow (for example: bend only on a held, strong-beat note whose target is a scale note; vibrato on notes of at least a quarter note).
5. **Fingering:** map the pitches to string and fret with a second path search: stay in the box, shift only at phrase boundaries, keep a hammer-on or pull-off on the same string, and put the bend on the B or G string where it's comfortable.
6. **Variation:** a regenerate is a new seed. Sample among near-best paths so each take differs but still obeys the rules. The same seed always gives the same result.
7. **Explainability:** keep why each note was chosen (chord note, passing note, motif repeat) for debugging and tests.

## 6. Tab format

- Bars with 8 cells (8th notes) or 16 cells (16th notes), bar lines, chord names above each bar, and technique marks in the cells: `5b7`, `7r5` (release), `3h5`, `5p3`, `3/5`, `5\3`, `7~`. Column width is `maxDigits + marks + 1`, so rows stay aligned.
- A **text version** for screen readers and copying: note names per bar, as in section 4.
- Card layout should reuse the power-chord engine's tab component, working from 320 to 1920px and in light and dark themes, with no inline styles.

## 7. Audio

- **Lead voice:** a synthesized guitar-like tone (sawtooth into distortion into a filter), louder than the backing, with separate volume.
- **Bends:** a pitch glide over about an 8th note; **vibrato:** a small LFO on long notes; **hammer-ons and pull-offs:** no new pick attack (softer re-trigger); **slides:** a quick glide.
- **Plays over the progression's backing** (power chords and drums at the selected feel and tempo), looped. Buttons: Play with backing, Play lead only, Stop.
- The feel and tempo in use must be **visible on the Chords page** (audit gap). Add the Feel control there or show the current feel with a link to change it.
- Stop playback when leaving the page, or provide a global stop (audit gap).

## 8. UI on the Chords page

- **Selecting a progression card** (click or keyboard) expands a panel under it with two tabs, **Intro melody** and **Lead solo**:
  - Style: Hook / Octaves / Harmony (intro); Chill / Classic / Shred (solo)
  - Length: 4 or 8 bars (intro); 8 or 16 bars (solo)
  - **Generate**, **Play with backing**, **Play lead only**, **Copy tab**, **Use in my song**
- **"Use in my song"** sends the key, the progression (as the Chorus progression) and the chosen melody or solo to the Generator's shared state, then offers to go to the Generator. It fills the Intro or Solo section, and those sections stay editable and lockable as today.
- Keep one expanded card at a time; on phones the panel sits full-width under the card.
- Tap targets are at least 44px; no text below 12px; contrast is at least 4.5:1 for small text (audit gaps).

## 9. Data and code layout

- `data/lead-rules.json`: scales per style, chord-note rules per degree, cost weights, the arc per part, bend and technique rules, fret limit.
- `data/lead-rhythms.json`: rhythm cells per style, feel and position in the phrase.
- `lib/melody.ts`: pure functions `generateLead({ key, progressionId, part, style, bars, feel, seed })` that return `{ notes: [{ bar, cell, midi, string, fret, technique?, durationCells, role }], tab, text }`.
- `lib/fretboard.ts`: shared with the power-chord engine (string maths, fingering search, tab rendering).
- The Generator's Solo section uses `generateLead({ part: 'solo', ... })`; retire `leadLick` and `pentatonicBox`.
- Record the owner's decisions in `DECISIONS.md`.

## 10. Chords page audit gaps to fix alongside this (found on 2026-09-27)

1. It's labelled "Power chord library", but it shows 6 progressions from 4 chords per key; there's no view of all 12 power chords.
2. **Dead end:** clicking a card does nothing, and there's no way to use a progression in the Generator. This feature fixes it with the expanded panel and "Use in my song".
3. **Playback uses the Generator's feel,** which isn't shown here.
4. The recommended card's play icon is filled red, which reads as "playing" when nothing is.
5. The highlighted "most common" card has no label.
6. Roman numerals and the Brightest/Darkest sort are unexplained, and chips don't show their degree (I, V, vi, IV).
7. Tap targets are too small (play buttons 13×13px, key buttons 33×27px).
8. Text is too small (7px chip tabs and sharp/flat labels) and some is too faint ("Key" and "Sort" 3.8:1, sharp/flat labels 3.4:1).
9. Screen readers hear raw tab text ("A5 e|- B|- …"); the chip's label isn't announced.
10. Music keeps playing after you go to the home page, with no stop control there.

## 11. Open decisions to ask the owner first

1. **Build order:** the power-chord engine first (recommended), or this first with the shared fretboard and tab modules?
2. **Default intro style:** Hook, Octaves or Harmony?
3. **Solo fret limit:** 12 like the chords, or up to 15 for solos?
4. **Lengths:** intro 4 or 8 bars by default; solo 8 or 16?
5. **Technique notation:** standard tab marks as above, or simplified?
6. **"Use in my song":** replace the Generator's Intro and Solo sections, or add them as extra sections?
7. **The Feel control on the Chords page:** a full control, or a read-out with a link?
8. **Test tooling:** OK to add Playwright to the repo as a dev dependency (shared with the engine brief)?

## 12. Verification

**Automated, for all 12 keys × 6 progressions × both parts × every style × 50 seeds:**
1. Every note is in the chosen scale (passing notes only where the style allows); no note is above the fret limit.
2. At least 75% of strong beats land on the current chord's notes, with the third chosen correctly for major or minor degrees.
3. No leap bigger than a fifth; every leap of a fourth or more is followed by a step back.
4. The last note is the root or 3rd, on a strong beat, held.
5. Every bend goes from a scale note to a scale note; hammer-ons and pull-offs stay on one string; each phrase fits a 4-fret position.
6. The intro repeats its motif (it's recognisable); the solo's register rises to a peak in its second half.
7. The same seed gives an identical result; a new seed gives a different, valid result.
8. Audio notes and timing equal the tab; the text version equals the tab.

**Reference outputs:** section 4's example plus about 8 more, hand-checked, stored as fixtures at seed 0.

**Browser tests (Chromium and WebKit, light and dark, 320–1920px):** the panel opens and closes by mouse and keyboard, tabs never overflow, controls are at least 44px, contrast is at least 4.5:1, "Use in my song" fills the Generator correctly, and playback stops on leaving.

**Human check:** a mock-up with playback in several keys and styles for the owner and a guitarist to listen to. Tune `lead-rules.json` from the feedback.

## 13. Process

1. Read `CLAUDE.md`, `DECISIONS.md`, `docs/power-chord-engine-brief.md` and this brief.
2. Explain the plan, then ask section 11.
3. Build the pure logic in `lib/` with `npm run verify` extended, then build a **standalone mock-up** (tabs plus audio) for approval.
4. Build into the site on a feature branch, run lint, build, verify and the browser tests, and open a PR. The owner merges; then check the live site.
