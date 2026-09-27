# Palm/Mute: Expert Power-Chord Engine (brief for a new Claude Code session)

**How to use this file:** start a new Claude Code session in the `palm-mute` repo and say "read `docs/power-chord-engine-brief.md` and follow it". It describes where the project is today, the goal, the recommended design, the musical rules, and how to verify the result. Claude should **explain its understanding and plan first, answer the open decisions in section 13 with the owner, build a mock-up to approve, and only then build into the site**, following `CLAUDE.md`.

---

## 1. Context: the project today

- **What it is:** Palm/Mute is a pop-punk songwriting web app: pick a key and a feel, and it writes a song (Intro, Verse, Chorus, Solo, Breakdown) as power-chord tabs in E standard. It's live at https://palmmute.netlify.app.
- **Stack:** Next.js 15 static export, React 18, Tailwind 3 (tokens in `tailwind.config.js`), Tone.js for synthesized audio, deployed on Netlify.
- **Rules:** read `CLAUDE.md` first. Feature branch plus PR only, never merge your own PR, no force-push, lint and build must pass, and `data/*.json` is the single source of truth for musical content. `DECISIONS.md` records owner decisions; add to it.
- **Pages:** `/` is the **Count In** home page, `/generator/` is the song generator, `/chords/` is the chord library.

### Relevant code

| File | What it does today |
|---|---|
| `data/chord-library.json` | **One** voicing per root: root plus fifth on the lowest-fret string among E/A/D, with a `twoNoteTab` for chips. Its own note says it should be "regenerated programmatically". |
| `data/progressions.json` | 6 progressions as scale degrees (I, V, vi, IV …), `degreeOffsets`, a brightness sort. |
| `data/song-section-templates.json` | 5 sections: `degreeSequence`, bars, muted flag, captions; Breakdown forces half-time; Solo uses `leadLickFormula`. |
| `data/rhythm-patterns.json`, `data/feels.json` | 8-glyph strum patterns (`▼ ▲ ·`); Fast Punk and Half-Time share 180 BPM, Mid-Tempo is 120–150. |
| `lib/musicTheory.ts` | `pitchClassOf`, `chordFor(root)`, `resolveProgression`, `chordMidiNotes`, `leadLickRootFret`. |
| `lib/generator.ts` | `renderSection` builds a tab with **one column per chord** (`formatTab`); strum variation via `varyGlyphs`; Solo lick from the major pentatonic. |
| `lib/audio/engine.ts` | Plays each chord's MIDI notes per strum cell, with palm mute as a lowpass filter plus short notes. |
| `components/SectionCard.tsx`, `TabBlock.tsx` | Render a 6-line monospace tab (9px) in a card; five cards across on desktop. |
| `scripts/verify-data-layer.ts` (`npm run verify`) | Node assertions for the data layer. |

### Why the output sounds beginner-ish
1. **One voicing per chord, always low.** Everything sits between frets 0 and 5, whatever the section or key.
2. **No voice leading.** The next chord's shape is never chosen based on where the hand already is.
3. **No rhythm in the tab.** One column per chord and a separate glyph line: no palm-mute marks, dead strums, pushes, accents or bar lines.
4. **Sections don't contrast.** The verse and chorus use the same register and shapes.

> Note: earlier sessions used Playwright suites that lived in a scratch folder and **were not committed**. This work should add a proper test setup to the repo (see section 11), which needs the owner's OK for a new dev dependency.

---

## 2. Goal

Make every tab the generator produces **reliably sound and play like an experienced pop-punk guitarist wrote it**, using power chords **anywhere from the open position up to the 12th fret**, for all 12 keys × 6 progressions × 3 feels × every section, and every regenerate.

"Expert sounding" means, concretely:
- **Smart neck positions:** each section sits in a sensible 4–5 fret zone; the chorus lifts higher than the verse.
- **Efficient voice leading:** small hand moves, shared notes between chords, and same-fret string switches.
- **The right shape for the job:** 2-note for fast palm-muted parts, 3-note (octave) for big choruses, open-string chugs when the key allows, and octave riffs for intros and leads.
- **Real rhythm:** palm-muted 8th-note chugs, let-ring choruses, pushes (the next chord arriving an 8th note early), dead-strum ✕ fills, stops, and half-time breakdowns.
- **Always correct and playable:** every note is the right root, fifth or octave; every stretch is humanly playable; nothing goes above the fret limit.

---

## 3. Recommended design (options considered)

| Option | Summary | Verdict |
|---|---|---|
| A. Hand-written voicing library | Several authored shapes per chord, simple picking rules | Quick, but lots of manual data, no voice leading, doesn't scale |
| **B. Voicing search** | Generate every playable shape per chord (frets 0–12), score them with guitarist rules, pick the best path through the progression | **Recommended: the "where on the neck" engine** |
| **C. Section recipes** | Rhythm and articulation templates per section × feel, filled with B's chords; real bar-by-bar tabs | **Recommended: the "how it's played" layer** |
| D. AI model writes tabs | Ask an LLM for tabs | Rejected: unreliable notes and stretches, not repeatable, needs B's rules to check anyway |

**Build B + C**, keep the existing sections, progressions and feels, and keep everything deterministic from a seed (regenerate = new seed).

---

## 4. Music theory reference (verify with code, don't trust memory)

**Tuning (E standard, open-string MIDI):** E2=40, A2=45, D3=50, G3=55, B3=59, e4=64. A note's pitch is `open[string] + fret`. **The B string is a major third (4 semitones) above G; every other adjacent pair is a fourth (5).** So any shape that crosses from G to B shifts one fret up.

**Power-chord shapes** (R = root, 5 = fifth, 8 = octave; `f` = root fret; strings listed low to high):

| Shape | Notes | Use |
|---|---|---|
| E-root 2-note | E:`f` (R), A:`f+2` (5) | Workhorse for verses and choruses |
| A-root 2-note | A:`f` (R), D:`f+2` (5) | Workhorse |
| D-root 2-note | D:`f` (R), G:`f+2` (5) | Higher keys; sparingly |
| E-root 3-note | E:`f`, A:`f+2`, D:`f+2` (8) | Big, ringing choruses |
| A-root 3-note | A:`f`, D:`f+2`, G:`f+2` (8) | Big, ringing choruses |
| D-root 3-note | D:`f`, G:`f+2`, B:`f+3` (8) | Rare; note the B-string shift |
| Inverted ("fifth on the bottom") | E:`f` (5), A:`f` (R) | Thick, one-finger barre; good for pushes and accents |
| Open-string power chord | open root string plus fretted fifth, e.g. E5 = E:0, A:2; A5 = A:0, D:2; D5 = D:0, G:2 | Keys of E, A and D; verse chugs and pedals |
| Octave riff (lead/intro) | A:`f` (R) + G:`f+2` (8), D string muted; or E:`f` + D:`f+2` | Intros, fills, melodic hooks |

**Hard constraints:** every fretted note is at most **12** (make the limit a config value); the span within one chord is at most 3 frets; only roots on the E, A and D strings for rhythm parts (G-string roots only for octave riffs). Every voicing must produce exactly the chord's pitch classes {R, 5} (plus the octave for 3-note shapes). **Assert this in code for every generated chord.**

**Worked examples (hand-verified), key of G, I-V-vi-IV = G5 D5 E5 C5:**
- **Compact low/mid path** (frets 3–9): G5 = E3+A5 → D5 = A5+D7 → E5 = A7+D9 → C5 = A3+D5.
  The A-string 5th fret is shared between G5 (its fifth) and D5 (its root): a common-tone move.
- **Lifted chorus path** (frets 7–12): G5 = A10+D12 → D5 = E10+A12 → E5 = A7+D9 → C5 = E8+A10.
  G5 to D5 is a same-fret string switch (10 on A to 10 on E).
- Check: A+10 = G, D+12 = D (fifth of G), E+10 = D, A+12 = A (fifth of D), A+7 = E, D+9 = B, E+8 = C, A+10 = G. ✓

---

## 5. Voicing engine (option B)

1. **Candidates:** for each chord in a section, enumerate every shape from section 4 at every root fret where all notes are between 0 and the fret limit. Tag each with shape type, position (the index-finger fret), string set, and whether it's open.
2. **Score each chord's voicing and each move between chords** (lower is better). Suggested starting weights, tuned later against the reference tabs and a guitarist's ear:

| Term | Default | Meaning |
|---|---|---|
| Position move | 1.0 per fret | Distance the index finger travels between consecutive chords |
| String-set change | 0.5 | Switching the root between E, A and D strings (small, because same-fret switches are idiomatic) |
| Common tone | −0.75 | A fretted note (same string and fret) is held between chords |
| Zone | 2.0 per fret outside | Chord leaves the section's 5-fret zone |
| Register target | 0.4 × distance | Average fret vs the section's target position (see section 6) |
| Open-string bonus | −1.0 | Open voicing in verse or intro when the key allows |
| D-string root | +1.0 | Prefer E and A roots |
| 3-note in a fast palm-muted part | +1.0 | Keep chugs tight |
| Inverted outside pushes and accents | +0.5 | Use for colour, not by default |
| Same chord, different voicing, same section | +3.0 | Repeated chords stay put |

3. **Pick the lowest-scoring sequence** through the section's chords with the Viterbi algorithm (dynamic programming over candidates × chords), including carry-over from the previous section so section boundaries stay playable.
4. **Variation by seed:** a regenerate samples a different path among the top few whose score is within a small margin of the best, so results stay "expert" but vary. The same seed always gives the same path.
5. **Explainability:** keep the chosen path's scores so tests and debugging can show *why* a voicing was picked.

---

## 6. Section recipes (option C)

Each section gets a **register target**, **shape preferences** and **rhythm recipes** per feel. Suggested defaults:

| Section | Register | Shapes | Rhythm (Fast Punk / Half-Time / Mid-Tempo) |
|---|---|---|---|
| Intro | Low or open, or an octave riff | Octave riff or 2-note | Octave-riff 8ths **or** 2 bars of palm-muted chugs building into open hits |
| Verse | Lowest comfortable zone (open to 5th fret) | 2-note, open strings when available | Palm-muted 8ths with accents on 1 and the "&" of 2 / half-time chug `▼··▼··▼·` / skank upstrokes |
| Chorus | **Lift** 3–7 frets above the verse (but ≤ 12) | 3-note | Let-ring 8ths with a **push** into bars 2 and 4 (the next chord on the last 8th); crash accent on 1 |
| Solo | Existing pentatonic lick, positioned relative to the chorus zone | Single notes | Unchanged, but aligned to the chorus position |
| Breakdown | Lowest zone, open strings when possible | 2-note or inverted | Half-time: heavy hits on 1 and 3, dead-strum ✕ fills, one full-band stop |

**Extras to support in the recipe format:** dead strums (`x` on the fretted strings), stops (rests with "N.C."), accents (`>`), palm-mute spans (`P.M.---`), let-ring (`let ring`), pushes (anticipations tied into the next bar), and 16th-note gallops (`▼▼▼·` style) as an option for Fast Punk.

Optional, to ask the owner about: a **pre-chorus** section (IV–V build with a stop), and a **final-chorus lift** (up a whole step, or 3-note shapes for the whole last chorus).

---

## 7. Tab rendering

- **Real bars:** 8 cells per bar for 8th notes (16 for gallops), bar lines `|`, one row per string, plus an **annotation row** for `P.M.---`, `let ring`, `>` accents and `N.C.`.
- **Alignment:** each column is `maxDigits + 1` characters wide, so two-digit frets (10–12) stay aligned.
- **Example (verified, key of G verse, palm-muted, G5 G5 D5 D5 with a shared A-string note):**
```
   P.M.-------------------------------------------------------|
e|----------------|----------------|----------------|----------------|
B|----------------|----------------|----------------|----------------|
G|----------------|----------------|----------------|----------------|
D|----------------|----------------|7-7-7-7-7-7-7-7-|7-7-7-7-7-7-7-7-|
A|5-5-5-5-5-5-5-5-|5-5-5-5-5-5-5-5-|5-5-5-5-5-5-5-5-|5-5-5-5-5-5-5-5-|
E|3-3-3-3-3-3-3-3-|3-3-3-3-3-3-3-3-|----------------|----------------|
```
- **Example (verified, key of G chorus, let ring, with a push: C5 arrives on the last 8th of bar 3):**
```
   let ring ---------------------------------------------------|
e|----------------|----------------|----------------|----------------|
B|----------------|----------------|----------------|----------------|
G|----------------|----------------|----------------|----------------|
D|----------------|7-7-7-7-7-7-7-7-|9-9-9-9-9-9-9-5-|5-5-5-5-5-5-5-5-|
A|5-5-5-5-5-5-5-5-|5-5-5-5-5-5-5-5-|7-7-7-7-7-7-7-3-|3-3-3-3-3-3-3-3-|
E|3-3-3-3-3-3-3-3-|----------------|----------------|----------------|
```
- **Card layout is a design decision** (section 13). Full bars are much wider than today's 4-column tabs, so options include showing 2 bars per line and wrapping, horizontal scroll inside the card, or a compact card with a "full tab" view. Whatever is chosen must work at 320px through 1920px and in light and dark themes. Check the existing tab styles and design tokens, and don't use inline styles.

---

## 8. Data model changes (keep `data/` the source of truth)

- `data/voicing-shapes.json` (new): shape definitions as string-and-offset lists (from section 4), with tags (`twoNote`, `threeNote`, `inverted`, `open`, `octaveRiff`) and per-shape costs.
- `data/section-recipes.json` (new): register targets, zone width, shape preferences, rhythm recipes per section × feel, articulation markings.
- `data/engine-settings.json` (new): fret limit (12), max span, and the cost weights from section 5, so tuning never needs code changes.
- `data/chord-library.json`: either **generate it** from the shapes (its own note asks for this) or keep it only for the Chords page chips. Decide with the owner, and make sure the Chords page and the Power Chords panel stay consistent with what the Generator shows.
- The same seed produces the same tab. Existing lock and regenerate behavior must keep working (a locked section never changes, even across key and feel changes).

---

## 9. Audio

`lib/audio/engine.ts` must play **the voicing that's shown**: the exact strings and frets, via `open[string] + fret`, including 3-note shapes. It should also play palm-muted hits short and dark, let-ring hits long, dead strums as a short percussive click, pushes a full 8th note early, and stops as silence. Tempo and feel handling stays as is.

---

## 10. UI (small, optional, owner decides)

- Optionally a **"Neck: Low / Mid / High / Auto"** control on the Generator that shifts the register targets. "Auto" is the default and uses the section recipes.
- Section cards could show a tiny "frets 5–9" position badge.
- No new pages. Keep the Count In home, the Shutter menu, dark mode and responsive rules intact.

---

## 11. Verification (this is what makes it "reliable")

**Automated invariants, for every key × progression × feel × section and 50 seeds:**
1. Every chord's notes are exactly its root and fifth (plus the octave for 3-note shapes); the pitch classes match the progression's degrees in that key.
2. No fret above the limit; span within a chord ≤ 3; roots only on the allowed strings.
3. Position moves between consecutive chords within a section ≤ 5 frets, unless an explicit shift is recorded.
4. The chorus register is higher than the verse's, or equal when the verse is already high, and never above the limit.
5. Tab columns align (each string row the same length; bars have 8 or 16 cells); annotation spans match bars.
6. The same seed gives an identical tab; a new seed gives a visibly different but still valid tab.
7. Audio MIDI notes equal the tab's string and fret notes.
8. Lock and regenerate semantics are unchanged.

**Reference tabs:** ~10 hand-verified expected outputs (including section 4's examples) checked into the repo as fixtures and compared exactly, at seed 0.

**Browser tests:** add Playwright to the repo as a dev dependency (ask the owner). Port the checks from earlier sessions (routes, menu, dark mode, the Count In headline fit, the title board) and add tab rendering checks: no overflow at 320–1920px, in both Chromium and WebKit, light and dark.

**Human check:** before calling it done, give the owner a mock-up with audio playback of several keys and sections so a guitarist can listen and play along. Adjust the weights in `engine-settings.json` based on the feedback.

---

## 12. Process

1. Read `CLAUDE.md`, `DECISIONS.md`, this brief, and the files in section 1.
2. **Explain your understanding and plan to the owner**, then ask the section 13 questions.
3. Build the engine as pure functions in `lib/` (no React), with `npm run verify` extended for the invariants and fixtures.
4. **Mock-up first:** a standalone HTML page showing generated tabs for several keys and sections, with playback, for owner approval.
5. Build into the site on a feature branch (e.g. `feature/expert-voicings`), and run lint, build, verify and the browser tests.
6. Open a PR with results; the owner merges. After the merge, check the live site.

---

## 13. Open decisions to ask the owner at the start

1. **Fret limit:** is 12 a hard maximum for every note, or can a chord's fifth or octave reach 14 when the root is at 12?
2. **Card layout for longer tabs:** wrap 2 bars per line, scroll inside the card, or a compact card plus a "full tab" view?
3. **Chord library and Chords page:** generate `chord-library.json` from the new shapes, or keep the simple low voicings there?
4. **New sections:** add a pre-chorus? A final-chorus lift?
5. **Neck control:** add the "Low / Mid / High / Auto" control, or keep it automatic only?
6. **16th-note gallops** for Fast Punk: yes or no?
7. **Test tooling:** OK to add Playwright as a dev dependency?

---

## 14. Acceptance checklist

- [ ] Every generated tab passes all automated invariants across 12 keys × 6 progressions × 3 feels × 5 sections × 50 seeds.
- [ ] Reference tabs match exactly at seed 0.
- [ ] The chorus audibly and visibly lifts above the verse; the verse chugs palm-muted; the breakdown is heavy half-time with dead strums.
- [ ] Voicings use the whole neck up to the fret limit, choosing compact paths with shared notes and same-fret string switches.
- [ ] Tabs render as real bars with P.M., let ring, accents, pushes and ✕, aligned, readable at 320–1920px in light and dark.
- [ ] Audio plays exactly the tabbed notes and articulations.
- [ ] Lock, regenerate, key and feel behaviors are unchanged; the Chords page and Power Chords panel are consistent with the Generator.
- [ ] Lint, build, verify and the browser tests pass; `DECISIONS.md` is updated; the PR is opened and not self-merged.
