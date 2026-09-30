# How Palm/Mute works

Palm/Mute writes pop-punk songs the way a guitarist would, and then **proves** it didn't play a wrong note. This page walks through the music theory, the two engines and the proofs. Every number here comes from `data/*.json` or `npm run verify`.

- [1. The fretboard in one paragraph](#1-the-fretboard-in-one-paragraph)
- [2. Power chords: where on the neck](#2-power-chords-where-on-the-neck)
- [3. Section recipes: how it's played](#3-section-recipes-how-its-played)
- [3b. The song: plan, form and energy](#3b-the-song-plan-form-and-energy)
- [3c. Playability: what the hands have to do](#3c-playability-what-the-hands-have-to-do)
- [4. Tabs](#4-tabs)
- [5. Intro melodies and solos](#5-intro-melodies-and-solos)
- [6. The proofs](#6-the-proofs)
- [7. Tuning it](#7-tuning-it)

---

## 1. The fretboard in one paragraph

E standard, low to high: **E2 A2 D3 G3 B3 E4**, or MIDI 40, 45, 50, 55, 59, 64. A note's pitch is `open[string] + fret`. Adjacent strings are a fourth apart (5 semitones), **except G to B, which is a major third (4)**. That's why any shape that crosses from the G string to the B string shifts up one fret. It's the single most common source of wrong tabs, so the code never assumes a shape: it computes every pitch and checks it (`lib/fretboard.ts`).

## 2. Power chords: where on the neck

`lib/voicings.ts` · `data/voicing-shapes.json` · `data/engine-settings.json`

**Candidates.** For each chord, every shape is tried at every fret from 0 to 12 (the owner's limit for chords):

| Shape | Notes (f = root fret) | Used for |
|---|---|---|
| E-root 2-note | E:f · A:f+2 | Verses, choruses |
| A-root 2-note | A:f · D:f+2 | Verses, choruses |
| D-root 2-note | D:f · G:f+2 | Last resort only |
| E-root 3-note | E:f · A:f+2 · D:f+2 | Big choruses |
| A-root 3-note | A:f · D:f+2 · G:f+2 | Big choruses |
| Inverted | E:f · A:f (fifth on the bottom) | Not used in rhythm parts (reads as a wrong chord) |
| Open | e.g. E5 = E0 · A2 | Verses and chugs in E, A, D |
| Octave riff | A:f · G:f+2 (or E:f · D:f+2) | Intros, labelled "G oct" (root doubled, no fifth) and downpicked |

The D-root 3-note shape (octave on the B string, e.g. D6 G8 B9) is listed in `rareShapes` and never used in a rhythm part. An open D-string root (D0 G2) is never used where chords ring, because nothing mutes the open low E and A strings; fretted D-root shapes stay as a last resort for high-key choruses.

**Scoring** (lower is better), from `engine-settings.json`:

| Rule | Weight |
|---|---|
| Hand moves between chords | 1.0 per fret |
| Root switches string | 0.5 |
| A note is held between chords (common tone) | −0.75 each |
| Outside the section's hand zone (target −1 … +4 frets) | 2.0 per fret |
| Distance from the section's register target | 0.4 per fret |
| Open strings in a verse or intro, when the key allows | −1.0 |
| D-string root | 6.0 |
| 3-note shape in a fast palm-muted part | 1.0 |
| Not the section's preferred shape (choruses prefer 3-note) | 0.5 |

**Registers.** Verses, intros and breakdowns sit in the key's lowest comfortable zone: the lowest E- or A-root position of the tonic, or open strings in E, A and D. The chorus **lifts 5 frets** above it. In high keys, where standard shapes run out of room below fret 12, it lifts less, but it never sits below the verse.

**Path search.** Repeated chords always keep one voicing. A branch-and-bound search over the distinct chords (at most 4) finds the cheapest path, plus every alternative within 2.5 of it. Its bound is exact: it allows for the most a held note could save. Seed 0 is the best path; regenerate walks through the near-best ones.

**Hand-checked in the brief, reproduced exactly at seed 0** (key of G, I-V-vi-IV = G5 D5 E5 C5):

| Path | Voicings | Why |
|---|---|---|
| Compact (the chips) | E3+A5 → A5+D7 → A7+D9 → A3+D5 | The A-string 5th fret is shared by G5's fifth and D5's root |
| Lifted (the Chorus) | A10+D12(+G12) → E10+A12(+D12) → A7+D9(+G9) → E8+A10(+D10) | G5 to D5 is a same-fret string switch, 10 to 10 |

The pitch check: A+10 = G, D+12 = D, E+10 = D, A+12 = A, A+7 = E, D+9 = B, E+8 = C, A+10 = G. ✓

## 3. Section recipes: how it's played

`data/section-recipes.json` · `lib/generator.ts`

Each section has a register, allowed shapes and rhythm variants per feel. They're written as 8-cell bars (eighth notes):

| Cell | Meaning |
|---|---|
| `D` / `U` | Down / up strum |
| `x` | Dead strum (muted, percussive) |
| `-` | Let the last hit ring |
| `.` | Rest |

Each bar is palm-muted (`pm`) or rings (`ring`). A recipe can also mark accents, **pushes** (the next chord an eighth early) and a **stop** (full-band N.C.). For example:

| Section | Fast Punk | Half-Time | Mid-Tempo | Pop Strum | Ballad |
|---|---|---|---|---|---|
| Verse | `D.DDD.DD` P.M., sparse chugs, accents on 1 and 3 | `D..D..D.` P.M. | `.U.U.U.U` P.M. skank | `D..U.UD.` P.M. | `D...D.D.` P.M. |
| Pre-chorus | `DDDDDDDD` P.M. ×2, then `D-D-D-D-` · `D-D-DDDD` let ring (a build) | `D..D..D.` ×2 → `D---D---` · `D---D-DD` | `.U.U.U.U` ×2 → `D-DUD-DU` · `D-DUDUDU` | `D.DU.UDU` ×2 → `D-DU-UDU` · `D-DUDUDU` | `D.D.D.D.` ×2 → `D---D---` · `D---D-D-` |
| Chorus | `DDDDDDDD` let ring, pushes into bars 2 and 4 | `D--D--D-` | `D-DUD-DU` | `D-DU-UDU` | `D---D---` |
| Breakdown | (always half-time) `D---D-xx` · `D---D---` · `D---D-xx` · `D.......` N.C. | | | | |
| Ending | `D-------` one final hit, let ring (or `D.......` stopped), at the Chorus's height | | | | |

Fast Punk and Half-Time share one 180 BPM click (the half-time feel is the drums, not the tempo). Mid-Tempo is adjustable (120–150). Pop Strum (150) and Ballad (80) have fixed tempos of their own.

Recipe plus voicing path gives **bar-by-bar events**. The tab, the audio and the screen-reader sentence are all rendered from those same events.

## 3b. The song: plan, form and energy

`data/section-harmony.json` · `data/song-forms.json` · `data/energy.json` · `lib/songPlan.ts` (Song Engine v2, Phase 1)

**One progression drives the whole song.** Each section's chords are a rule over the chosen progression, so a vi-IV-I-V song has a vi-IV-I-V verse:

| Section | Rule | In I-V-vi-IV | In vi-IV-I-V | In I-IV-V |
|---|---|---|---|---|
| Intro | The Chorus's first two chords | I V I V | vi IV vi IV | I IV I IV |
| Verse | The progression itself, sparser and palm-muted | I V vi IV | vi IV I V | I IV V V |
| Pre-chorus | A climb into the Chorus's first chord | IV IV V V | IV IV V V | IV IV V V |
| Chorus | The progression | I V vi IV | vi IV I V | I IV V V |
| Breakdown | The darkest two chords (vi first), else a tonic pedal | vi IV vi IV | vi IV vi IV | IV V IV V |
| Ending | Home | I | I | I |

A 3-chord loop holds its last chord for the fourth bar. The Solo is the lead engine over the progression.

**Forms.** The Generator shows the **Standard** form: Intro · Verse 1 · Pre-chorus · Chorus · Verse 2 · Pre-chorus · Chorus · Solo · Breakdown · Last chorus · Ending (57 bars, about 1:16 at 180 BPM). A **Short** form (no pre-chorus) is in the data for a later length control. Repeats reuse their section's material, with one declared variation each: **Verse 2 adds a push** (the next chord an eighth early at the first chord change after bar 1) and the **Last chorus plays twice**. Nothing else may differ, and verify checks it. Locking a section locks every place it plays.

**Energy.** Each chord section gets a score from what its tab plays: sounding eighths, how much rings, 3-note shapes and how high on the neck (weights in `data/energy.json`). The Chorus must beat the Verse in every song. Mean over the sweep: Verse 0.26 → Pre-chorus 0.54 → Chorus 0.88. The smallest gap between Chorus and Verse anywhere is 0.40.

**On the page** (option A from `docs/mockups/song-form.html`): a running-order strip sized by length (tap a part to play the song from there), and one card per part, in the order each first plays. A card lists every place it plays. Red is whatever is sounding now.

## 3c. Playability: what the hands have to do

`data/playability.json` · `lib/playability.ts` (Song Engine v2, Phase 2)

The voicing search knows each section's rhythm and tempo, so it judges a shape the way a guitarist experiences it:

- **Mute plans (R1).** Every string a strum could hit but the chord doesn't play needs something to silence it:
  - A string **between** two notes: the fretting finger next to it leans on it. It needs a fretted neighbour.
  - Strings **above** the chord: the underside of the fretting fingers.
  - Strings **below** the root: the root finger's tip takes the nearest, and the thumb takes the low E. On palm-muted bars, an accurate pick can skip the rest.

  A shape with no mute plan on a bar is never used there. That's why an open D5 can chug palm-muted but never ring: nothing mutes the open A. It's also why the `x-x-0-2-3` open D5 stays out for ringing chords.
- **Tempo-aware changes (R2).** A change costs its fret-equivalents: frets moved, +1 for a new root string, +0.5 for a 2↔3-note switch, +0.5 for leaving open position. That's divided by the time the hand actually has: from the old chord's last fretted hit to the new chord's first. A push counts as the eighth it lands on, and dead strums free the hand. Over 2 per 100 ms the search pays for it; **over 4 is never allowed**. Mid-Tempo is judged at 150. Fastest in the sweep: 3.90 (Fast Punk).
- **Picking hand (R3).** Fast downstroke runs (eighths at 5 strums a second or more) are capped by difficulty: Beginner 8, **Intermediate 16** (what the Generator plays until the Difficulty control arrives), Advanced no cap. Over the cap, chord strums alternate, with upstrokes on the offbeats. Only the pick direction changes, not the tab. Octave riffs skip a string, so they stay downpicked and count toward the rating.
- **Label honesty (R5).** A bar's name matches its notes: "C5" is exactly the root and fifth, "C oct" the root alone. A push plays the next bar's chord.
- **Rating (R4).** Each chord section gets 1–5 from its fastest change, thumb and lean mutes, long downpicked runs, stretch, high positions and 3-note shapes in fast palm-muting. A song is as hard as its hardest section. There's no UI for it yet (Phase 6). Today everything rates 1–3.
- **Hall of shame.** `scripts/fixtures/hall-of-shame.json` lists every tab the owner has flagged. Verify checks every render against it.

## 4. Tabs

`lib/fretboard.ts` · `components/TabBlock.tsx`

Real bars, **2 per line**, with header rows for chord names, P.M./let ring spans with N.C., and accents. Each column is as wide as its widest fret plus a dash, so 10–12 stay aligned. On the site the tab is SVG text drawn at 12px that shrinks to fit its card, so it never scrolls sideways. Screen readers get a sentence like *"G5: G on the low E string, 3rd fret, and D on the A string, 5th fret"* instead of dashes.

## 5. Intro melodies and solos

`lib/melody.ts` · `data/lead-rules.json` · `data/lead-rhythms.json`

1. **Rhythm first.** Each bar gets a rhythm cell from its role:
   - **Intro:** call, call, echo (the motif comes back in bar 3), ending.
   - **Solo:** low and sparse, answer, busier, **peak**, resolve.
2. **A hand position per 2-bar phrase.** The index finger sits on fret p, with a pinky stretch to p+4. Positions follow a register arc: the solo climbs from 7 semitones below the key's root to 9 above it at the peak. Shifts only happen between phrases.
3. **Pitches by a second-order Viterbi search** over the major-pentatonic notes under that hand position.
   - **Hard rules:** no leap bigger than a fifth; after a leap of a fourth or more, a step back the other way; end on the root or the key's 3rd, on a strong beat, held; an intro spans about an octave, a solo about two.
   - **Costs:** strong beats on chord notes (+3 if not, −0.4 for the right third: major on I/IV/V, minor on ii/iii/vi), steps over skips over leaps, no shuttling back and forth, the motif, the arc.
4. **Techniques** (solos):
   - Bends **only from a scale note to a scale note**, a whole or half step, on a held strong-beat note on the G, B or e string.
   - Hammer-ons and pull-offs on one string, onto a weak beat.
   - Slides into a new phrase along one string.
   - Vibrato on notes a quarter or longer.
5. **Styles:**
   - **Hook** (single notes), **Octaves** (doubled an octave up, skipping a string) and **Harmony** (diatonic thirds, else sixths).
   - **Chill**, **Classic** and **Shred** (tremolo runs).
6. **Generate and test.** Taste checks are soft costs in the search: the motif returning, at least 75% of strong beats on chord notes, the solo peaking in its second half. If a take misses one, it's regenerated from a derived seed. It stays deterministic: the same seed always gives the same lead.

## 6. The proofs

`npm run verify` (`scripts/verify-*.ts`) runs in CI on every pull request:

| Suite | What it covers | Checks |
|---|---|---|
| Data layer | Progressions per key, sort, playback = card, spoken text, song titles, a strum, tempo and recipe rhythm for every feel, a plan for every progression × section, forms that start on the Intro and end on the Ending | All keys × feels × sections |
| Voicing engine | Brief §11: right pitches and **degrees from the song's plan**, fret limit, stretch, allowed strings, no rare shapes, hand moves ≤ 5 frets, chorus above verse, **chorus energy above verse**, **every hit labelled honestly and with a mute plan, no change over 4 frets per 100 ms, chord downpicking within the cap, the hall of shame**, Verse 2 = Verse 1 + its push only, every form plays each part's material in order, aligned tabs, determinism, **audio = tab** (parsed back from the text), `chord-library.json` up to date | 210,000 renders covering 12 keys × 10 progressions × 5 feels × 7 sections × 50 seeds, plus 16 hand-checked reference tabs |
| Lead engine | Brief §12: scale, strong beats, thirds, leaps, endings, bends, legato, slides, hand positions, range, motif, peak, determinism, **audio = tab = text** | 72,000 leads (12 keys × 10 progressions × 2 parts × 3 styles × 2 lengths × 50 seeds), the brief's §4 hook rendered exactly, and 9 reference outputs |

Then **Playwright** (`e2e/`) runs in Chromium and WebKit at 320, 390, 834, 1440 and 1920px, in light and dark. It covers routes, the menu, dark mode, layout and alignment, tap targets (44px), text size (12px), contrast (4.5:1), screen-reader text, playback matching the tab, share tags and icons.

## 7. Tuning it

Nothing musical is hard-coded:

| File | Change it to… |
|---|---|
| `data/engine-settings.json` | Move the chorus lift, tighten or loosen voice leading, make shapes more or less likely, change the fret limit |
| `data/section-recipes.json` | Add rhythm variants, change which shapes a section may use |
| `data/section-harmony.json` | Change which chords a section plays over the progression |
| `data/song-forms.json` | Change the running order, or a repeat's variation |
| `data/energy.json` | Reweight what makes a section feel bigger |
| `data/playability.json` | Change the speed limit, the downpick caps, or what makes a section rate harder |
| `data/lead-rules.json` | Change the melodic taste (steps vs leaps, chord notes on strong beats, the solo's arc, bends) |
| `data/lead-rhythms.json` | Add rhythm cells for melodies and solos |

After tuning, run `npm run verify`. If a reference output changes, regenerate it with `npx tsx scripts/verify-voicings.ts --update-fixtures` (chords) or `npx tsx scripts/verify-melody.ts --update-fixtures` (leads), and hand-check the diff. Then listen in `docs/mockups/expert-voicings.html` and `docs/mockups/melody-and-solo.html`.
