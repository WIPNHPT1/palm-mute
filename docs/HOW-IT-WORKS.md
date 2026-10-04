# How Palm/Mute works

Palm/Mute writes pop-punk songs the way a guitarist would, and then **proves** it didn't play a wrong note. This page walks through the music theory, the two engines and the proofs. Every number here comes from `data/*.json` or `npm run verify`.

- [1. The fretboard in one paragraph](#1-the-fretboard-in-one-paragraph)
- [2. Power chords: where on the neck](#2-power-chords-where-on-the-neck)
- [3. Section recipes: how it's played](#3-section-recipes-how-its-played)
- [3b. The song: plan, form and energy](#3b-the-song-plan-form-and-energy)
- [3c. Playability: what the hands have to do](#3c-playability-what-the-hands-have-to-do)
- [3d. The critic: best of eight](#3d-the-critic-best-of-eight)
- [4. Tabs](#4-tabs)
- [5. Intro melodies and solos](#5-intro-melodies-and-solos)
- [5d. The Chord Lab](#5d-the-chord-lab)
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

Fast Punk and Half-Time share one 180 BPM click (the half-time feel is the drums, not the tempo). Mid-Tempo (140), Pop Strum (150) and Ballad (80) have fixed tempos of their own.

Recipe plus voicing path gives **bar-by-bar events**. The tab, the audio and the screen-reader sentence are all rendered from those same events.

### Grooves, sixteenths and riffs (Song Engine v2, Phase 4)

- **Six or more grooves per section in every feel.** Each groove is in `data/section-recipes.json`: an `all` rhythm, plus per-feel overrides where a feel needs its own. New ones:
  - **Verse:** gallop, stop-time, backbeat chugs.
  - **Pre-chorus:** build with a fill, stop and hit, gallop build, offbeat climb.
  - **Chorus:** accent hits, open gallop, half-note anthem, driving eighths.
  - **Breakdown:** gallop, stop-time hits, quarter-note chugs, chug and choke.
- **The 16th-note grid.** A bar is 8 cells, or 16 when it needs sixteenths (gallops, fills). Accents stay in eighths (0–7). **Layout D:** an eighth-note bar shares its line; a 16th-note bar gets a line to itself, so its text stays as big. Every tab from before Phase 4 is unchanged.
- **Guitar and drums together (R13).** A groove can carry its own drums, bar by bar, in its own grid. Kicks land under the accents (verify checks that every accented hit has a kick, snare or crash), and a push pulls the kick with it. `stopCells` are full-band stops: nothing sounds after one, drums included. Grooves without drums use the feel's kit.
- **Intro riffs that move (R12, `lib/riffs.ts`).** Four riffs are written from scale steps over each bar's chord (0 = root, 2 = third, 4 = fifth, 7 = octave), so they work in every key:
  - an **octave climb**;
  - a **low-string palm-muted gallop riff**;
  - an **open-string pedal riff** (only when the chords' roots are open strings);
  - a **hook line in octaves**.

  A Viterbi search places each note closest to the hand, moving the way the tune moves, and never over the speed limit. A riff that can't be played at the tempo in a key isn't offered there. Riffs keep their notes in every feel; the tempo changes. Verify checks every riff note is in the key, every bar has its chord's root, octaves are true octaves with a mute plan, moves stay under the limit, and audio = tab.

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

**Forms and length.** The song's length comes from the **Length** slider (2:30 to 5:30, in 15-second steps; default 3:15), and the form follows from it at the feel's tempo (`lib/songLength.ts`, rules in `data/song-forms.json`). There are three forms: **Short** (no pre-chorus), **Standard** (Intro · Verse 1 · Pre-chorus 1 · Chorus 1 · Verse 2 · Pre-chorus 2 · Chorus 2 · Solo · Breakdown · Last chorus · Ending) and **Extended** (Standard plus an Intro reprise, a third verse, pre-chorus and chorus). Every part plays its section's material some number of times in a row, within a range per part. The plan grows each form from its minimum one step at a time in a fixed order (choruses first, then the last chorus, verses, the solo, the intro…), keeps the step closest to the target, then nudges single short parts (intro, reprise, breakdown, last chorus, solo) up or down while that gets closer. Among forms that land within 4 bars, it keeps the one with the fewest repeats (Standard is preferred, Short and Extended cost a little extra); otherwise the closest. So 3:15 is a 145-bar Standard song at Fast Punk (180 BPM) but a 65-bar one at Ballad (80 BPM), and 5:30 at 180 BPM is a 249-bar Extended song. `npm run verify` checks every tempo the feels can play at every length step, with 8- and 16-bar solos: all land within 4 bars, except a 16-bar solo in a 2:30 ballad, where even the shortest song is longer. Repeats reuse their section's material, with one declared variation: **Verse 2 adds a push** (the next chord an eighth early at the first chord change after bar 1). Nothing else may differ, and verify checks it. Locking a section locks every place it plays.

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
- **Tempo-aware changes (R2).** A change costs its fret-equivalents: frets moved, +1 for a new root string, +0.5 for a 2↔3-note switch, +0.5 for leaving open position. That's divided by the time the hand actually has: from the old chord's last fretted hit to the new chord's first. A push counts as the eighth it lands on, and dead strums free the hand. Over 2 per 100 ms the search pays for it; **over 4 is never allowed**. Mid-Tempo is judged at its 140. Fastest in the sweep: 3.90 (Fast Punk).
- **Picking hand (R3).** Fast downstroke runs (eighths at 5 strums a second or more) are capped by difficulty: Beginner 8, **Intermediate 16** (what the Generator plays until the Difficulty control arrives), Advanced no cap. Over the cap, chord strums alternate, with upstrokes on the offbeats. Only the pick direction changes, not the tab. Octave riffs skip a string, so they stay downpicked and count toward the rating.
- **Label honesty (R5).** A bar's name matches its notes: "C5" is exactly the root and fifth, "C oct" the root alone. A push plays the next bar's chord.
- **Rating (R4).** Each chord section gets 1–5 from its fastest change, thumb and lean mutes, long downpicked runs, stretch, high positions and 3-note shapes in fast palm-muting. A song is as hard as its hardest section. There's no UI for it yet (Phase 6). Today everything rates 1–3.
- **Hall of shame.** `scripts/fixtures/hall-of-shame.json` lists every tab the owner has flagged. Verify checks every render against it.

## 3d. The critic: best of eight

`data/critic.json` · `lib/critic.ts` (Song Engine v2, Phase 3)

Every section on its own is already the search's best path, but a song can still be dull, or awkward where parts meet. So **BUILD SONG (and BUILD AGAIN) writes 8 takes of the whole song and keeps the one the critic scores highest**:

| Part of the score | What it rewards or penalises |
|---|---|
| Playability | − the song's difficulty over 1, − its fastest change over comfort |
| Arc | + how far the Chorus's energy tops the Verse's, + a Pre-chorus that builds between them |
| Hook | + the Chorus sitting higher on the neck, filling out with 3-note shapes, and busier than the Verse |
| Variety | + sections that don't all strum at the same density |
| Flow | − hand jumps bigger than 5 frets where one section hands over to the next in the running order |

- **Takes:** each take picks a seed per section from a seeded generator, so the same song seed always gives the same song. The page opens on song 0, whose first take is every section's own best. Across the sweep, 8 takes lift the kept score by 0.54 on average over the first take.
- **Locks:** locked sections, and parts carrying a lead line, keep their own inputs in every take.
- **BUILD SONG / BUILD AGAIN:** keeps your progression and never repeats the song on screen.
- **A section's ↻:** tries that section's next 8 different takes, each heard in the song as it stands, and keeps the best. Only that section changes, and it always changes.
- **Speed:** about 27 ms per build with Chromium's CPU slowed 4× (a stand-in for a mid-range phone; the budget is ~100 ms). `e2e/critic.spec.ts` holds it there.

## 4. Tabs

`lib/fretboard.ts` · `components/TabBlock.tsx`

Real bars, **2 per line**, with header rows for chord names, P.M./let ring spans with N.C., and accents. Each column is as wide as its widest fret plus a dash, so 10–12 stay aligned. On the site the tab is SVG text drawn at 12px that shrinks to fit its card, so it never scrolls sideways. Screen readers get a sentence like *"G5: G on the low E string, 3rd fret, and D on the A string, 5th fret"* instead of dashes.

**On the Generator (song builder).** Each section is a full-width card. Its tab is 2 bars a line on phones and 4 from tablet up (a 16th-note bar takes two slots), and is drawn as a songbook: bar numbers over each line, rhythm stems under the strings (from how long each strum or note actually lasts: eighths beamed within a beat, sixteenths in fours, a flag on a lone short note, a plain stem for a quarter or longer), and repeat dots with ×N when the section plays its bars more than once. These marks are drawn over the tab (`components/TabBlock.tsx`, using the columns `renderTab` records); the tab text is unchanged.

**Options.** Every card has an Options panel (collapsed until you open it) that changes only that section, everywhere it plays: the **groove** (any of the section's grooves, by name, instead of the take's; riffs that can't play in the key or tempo are shown with the reason), **playing style** (palm-muted or open throughout; 2- or 3-note shapes), **structure** (how many times each place plays, which the length plan then keeps fixed; Verse 2's push on or off; the Last chorus up a whole tone; a lead's length) and **drums** (the groove's own, half-time or none). These are inputs to the same search, so every rule above still holds: `npm run verify` renders every groove with every playing style and shape size in 4 keys × 4 progressions × every feel (24,480 renders) through the same checks as the seed sweep. The Ending has two more grooves: a **chorus tag** (the progression's last two chords, then home) and a **fade-out** (the progression, each bar quieter).

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

### Solos that know the song (Song Engine v2, Phase 5)

A solo the Generator writes gets a **song thread** (`songThread` in `lib/generator.ts`):

- **The song's motif (R15).** Where it comes from:
  1. the Intro melody's first bar, if the Intro is a melody;
  2. otherwise the Intro riff's first bar (a busy bar is quoted by its outline: the notes on the beats, at most 5);
  3. otherwise the Chorus's chord roots as four quarter notes.

  The solo's first answer bar (bar 3) restates it in its own register: the motif's rhythm, and its shape note to note. It's played plainly, with no bends or hammer-ons, so it's heard as the tune.
- **The song's own chords (R16).** The solo plays over the Chorus's bar plan (for a 3-chord progression, the Chorus's 4 bars) instead of the progression looped.
- **Its peak on the strongest chord.** The strongest chord is the one the Chorus voices highest on the neck. The solo's high point moves to the second-half bar that plays it, with the arc's peak going along.

Pressing BUILD SONG, BUILD AGAIN or the Solo's ↻ writes a fresh solo. The Solo takes its thread when it's written (a build, its own ↻, a new progression), so pressing ↻ on another section never changes it. Across the verify sweep, the motif returns in every solo, and the peak lands on the strongest chord every time a second-half bar plays it.

## 5a. Difficulty and style presets

**Difficulty** (Beginner / Intermediate / Advanced, default Intermediate) is an input to every section, like the key: the voicing search, the critic and the cards all see it (`data/difficulty.json`). A Beginner's song uses eighth-note grooves and 2-note shapes only, no Intro riffs, downpicked runs of at most 8 (over that, chord strums alternate), and Chill or Classic solos; Intermediate adds gallops, riffs and shred solos with runs up to 16; Advanced lifts the run cap. Grooves a level rules out stay on the Rhythm tab, greyed with the level they need. `npm run verify` renders every level across keys, progressions and feels through the same checks, and checks that a Beginner's sections really have no sixteenths, riffs or 3-note shapes.

**Style presets** (`data/style-presets.json`) are starting points: Skate punk (fast, palm-muted gallops, 2:30, stops on a hit) and 2000s pop-punk (Pop Strum, an octave hook, 3-note choruses with pushes, the last chorus up a tone). A preset sets the setup and each unlocked section's Options, choosing for each section the first of its preferred grooves that can play in the song's key; everything stays editable, and **Your own** clears it. Verify checks every preset finds a playable groove for every section it names, in every key.

### Practising: the transport

The bar fixed to the bottom of the Generator plays the song from the top (or from any part of the running order) and says where it is. **Loop part** plays one part round and round; **count-in** plays a bar of four clicks first (scheduled on the same clock as the music, so a stop cancels them); **speed** sets the tempo to 90, 75 or 50% of the song's (a slower tempo, not a lower pitch). As each bar starts, the card it belongs to lights its tab bar under a cursor: the song's bar is mapped back to the bar of the card's tab (a part plays its material several times, and the tab shows it once). Space and R are the keyboard shortcuts for play and build again.

### Sharing and takes

**Share the song** gives a link with the whole song in its hash (`lib/share.ts`): the setup, and each section's seed, lead, Options and Solo thread, with locked sections and what they were locked in. The engine is deterministic, so the link rebuilds exactly the same song; nothing is stored anywhere. A link is treated as untrusted input: every field is checked against the data (keys, feels, progressions, grooves, styles, lengths, numbers in range, titles from the list), anything that doesn't fit is dropped, and a link that can't be read opens a fresh song. `npm run verify` sends 60 songs (every key × feel, with presets, leads, options, threads and a locked part) through their links and gets each back unchanged, and checks broken and tampered links are refused or cleaned.

Each section also keeps its **last 8 takes** (‹ › on its card), so a new take never loses the one you liked.

## 5b. MIDI export

**Take it away → DOWNLOAD MIDI** writes the song as one Standard MIDI File (type 1, 480 ticks per quarter note): the tempo, 4/4, the key signature and a marker where each part of the running order starts, then one track per part of the owner's lane table (`data/midi-lanes.json`) and General MIDI drums (`lib/arrange.ts`, written by `lib/midi.ts`, which has no dependencies):

| Track | Notes | What it plays |
|---|---|---|
| Sub | 24–38 | The chord's root, held for the bar, under choruses and the breakdown |
| Bass | 36–52 | The root on every strum of the rhythm guitar (palm-muted strums stay short) |
| Piano left hand | 43–55 | Root and fifth, held, everywhere but the Intro |
| Rhythm guitar | concert pitch | Exactly the tab, strum for strum |
| Lead vocal (guide) | 57–76 | A hook-style melody from the lead engine over the verses and choruses (a placeholder for a singer) |
| Piano right hand | 67–84 | The chord's triad on every beat, in pre-choruses and choruses |
| Pads / strings | 72–88 | The triad held, in choruses |
| Lead guitar | concert pitch | Exactly the Intro melody or Solo, with string bends as pitch bends |
| Synth leads, arps | 76–96 | An eighth-note arpeggio of the triad in the Last chorus |
| Drums | channel 10 | Exactly the drums the audio plays |

The guitars and the drums come from the same data as the sound: the playback bars (`lib/playback.ts`) and one drum function (`lib/drums.ts`) that the audio engine also uses. The other parts follow each bar's chord (its root, and minor on the key's ii, iii and vi, since power chords don't say), including a Last chorus that goes up a tone. `npm run verify` builds 120 songs (4 keys × 5 feels × 3 lengths × 2 sets of card options), writes each file, reads it back with a strict parser and checks that every note reads back exactly, sits inside its lane (the guitars at concert pitch), and that the guitars and drums equal the audio; the browser tests download the real file and check it against what PLAY SONG plays.

## 5c. PDF songbook

**Take it away → DOWNLOAD PDF** lays the song out as pages of drawing operations in millimetres (`lib/songbook.ts`, pure), then draws them with jsPDF (`lib/pdf.ts`, loaded on demand) with Archivo Black and Space Mono embedded. A4 or US Letter:

1. **Cover:** the wordmark, the title on a split-flap board, the song's facts and its running order (a box per part, sized by its bars).
2. **Chart:** every chord shape the song uses as a chord box (six strings, four frets from the lowest fretted one, × and ○, the degree underneath), and the form: each part's start time, bars and chords.
3. **Sections:** each in full, never cut: its heading, groove and frets, where it plays, its chord boxes, and its tab as a songbook (the same tab text as on screen, 4 bars a line, with bar numbers, rhythm stems and repeat marks), plus a legend of the lead techniques a solo uses.

Text is measured with the PDF's own font metrics, so nothing overflows. `npm run verify` makes 120 real PDFs (3 keys × 5 feels × 2 lengths × 2 paper sizes × 2 option sets, including a 16-bar solo, an Intro melody, a chorus tag and a key change) and checks the file (every page, the three fonts embedded, the title) and the layout: every operation on its page, all text inside the margins, tab panels never overlapping each other or the footer, every section once and in order, and every bar of every section numbered 1 to n.

## 5d. The Chord Lab

`/chords/` is a guitarist's chord toolbox, **separate from the song generator**: it has its own key, tuning and left-handed switch, and nothing it does goes to or comes from a song. Everything in it plays one feel, Pop Strum at **150 BPM**, through the same synth guitar as the rest of the site. The music maths is pure TypeScript in `lib/lab/` (no React), driven by `data/tunings.json`, `chord-types.json`, `chord-templates.json`, `open-chords.json`, `chord-moves.json` and `mood-map.json`.

- **Tunings:** E standard, E♭ standard, Drop D and Drop C♯. A chord is named by what it *sounds* in the picked tuning, so a tuning changes the frets, never the chord's name.
- **Dictionary (with the neck):** 10 chord types (power, octave, major, minor, sus2, sus4, add9, 7, maj7, m7). A voicing is a curated open shape, a moveable template slid up the neck, or a grip the search finds (every way to play the chord's notes inside a four-fret window, a few per stretch of neck, at most a dozen in all), kept only if it plays exactly the chord's notes with the root in the bass, fits four fingers inside a four-fret reach (five for an add9), and mutes every skipped inner string with a fretted neighbour. Each gets fingers, a barre if it needs one, and a difficulty from 1 to 5.
- **Name that chord:** tap frets on the neck (or type `x32010`) and the shape is named: best name first, alternatives, slash chords for inversions, the major keys it belongs to with its numeral in each, and a "did you mean" for a shape one fret off a chord.
- **Progression builder:** the key's I ii iii IV V vi plus the borrowed bIII, iv, bVI and bVII, in a loop of up to eight. "What next?" suggests the three likeliest chords from `data/chord-moves.json`; three meters (dark to bright, settled to restless, how classic) come from `lib/lab/mood.ts`.
- **Key finder & transposer:** type chord names and get the major keys they fit, best first, with borrowed chords flagged; move them by semitones, to a key, or for a capo (the shape to play is the sound minus the capo's frets).
- **Mood map:** the ten progressions and 16 more plotted by the same scores, spread across the plot and nudged only so their names never overlap.

`scripts/verify-lab.ts` proves it on every build: every voicing in every tuning is exactly its chord (right notes, root in the bass, within reach, fingered, muted), every voicing names back to its own chord, every one of the ten progressions is found in its own key in all twelve keys (as full and as power chords), the capo maths agrees with the shapes in every tuning, and no two names on the mood map overlap.

## 6. The proofs

`npm run verify` (`scripts/verify-all.mjs` runs the seven `scripts/verify-*.ts` suites side by side, about 75 s) runs in CI on every pull request:

| Suite | What it covers | Checks |
|---|---|---|
| Data layer | Share links: 60 songs open unchanged from their links, bad links refused or cleaned; style presets; song length: 156 plans (6 tempos × 13 lengths × 8/16-bar solos) within 4 bars, every part in its range, deterministic; progressions per key, sort, playback = card, spoken text, song titles, a strum, tempo and recipe rhythm for every feel, a plan for every progression × section, forms that start on the Intro and end on the Ending | All keys × feels × sections |
| Voicing engine | Brief §11: right pitches and **degrees from the song's plan**, fret limit, stretch, allowed strings, no rare shapes, hand moves ≤ 5 frets, chorus above verse, **chorus energy above verse**, **every hit labelled honestly and with a mute plan, no change over 4 frets per 100 ms, chord downpicking within the cap, the hall of shame**, Verse 2 = Verse 1 + its push only, every form plays each part's material in order, aligned tabs, determinism, **audio = tab** (parsed back from the text), `chord-library.json` up to date | 210,000 renders covering 12 keys × 10 progressions × 5 feels × 7 sections × 50 seeds, plus 16 hand-checked reference tabs |
| Song critic | Best of 8 is deterministic and beats or ties every take; the kept song's Chorus is its peak; locked sections never move; a build never repeats the song on screen; a section's ↻ always changes that section, deterministically | 600 songs × 8 takes (12 keys × 10 progressions × 5 feels, song seed 0), plus lock, repeat and ↻ checks per key and progression |
| Lead engine | Brief §12: scale, strong beats, thirds, leaps, endings, bends, legato, slides, hand positions, range, motif, peak, determinism, **audio = tab = text**; Phase 5: **the solo quotes the song's motif, plays the Chorus's chords and peaks on its strongest chord** | 72,000 leads (12 keys × 10 progressions × 2 parts × 3 styles × 2 lengths × 50 seeds), the brief's §4 hook rendered exactly, and 9 reference outputs |
| MIDI export | Every file reads back exactly through a strict parser; every note inside its lane (guitars at concert pitch); rhythm guitar, lead guitar and drums equal the audio; markers where each part starts; tempo, 4/4, instruments and channels; no drum track when drums are off | 120 songs (4 keys × 5 feels × 3 lengths × 2 option sets) |
| PDF songbook | Real PDFs: every page, three fonts embedded, the title; every operation on the page, text inside the margins, tab panels never overlapping or in the footer, every section once, every bar numbered 1 to n, deterministic layout | 120 songbooks (3 keys × 5 feels × 2 lengths × 2 paper sizes × 2 option sets) |
| Chord Lab | Every dictionary voicing in all four tunings (4,612) is exactly its chord and names back to itself, every chord has at least 4 shapes (3 in the drop tunings) reaching from the nut up the neck; all ten progressions found in their own key in all 12 keys; transposing up and back is the identity; the capo maths agrees with the shapes; the mood map has no overlapping names | `scripts/verify-lab.ts` |

Then **Playwright** (`e2e/`) runs in Chromium and WebKit at 320, 390, 834, 1440 and 1920px, in light and dark. `e2e/song-builder-responsive.spec.ts` is the song builder's responsive gate (docs/song-builder-prd.md B12): no sideways scroll, controls ≥ 44px, text ≥ 12px and nothing clipped, in every project, for the setup, the folded summary and the longest song. It also covers routes, the menu, dark mode, layout and alignment, tap targets (44px), text size (12px), contrast (4.5:1), screen-reader text, playback matching the tab, share tags and icons.

## 7. Tuning it

Nothing musical is hard-coded:

| File | Change it to… |
|---|---|
| `data/engine-settings.json` | Move the chorus lift, tighten or loosen voice leading, make shapes more or less likely, change the fret limit |
| `data/section-recipes.json` | Add rhythm variants (8 or 16 cells, with their own drums and stops), intro riffs (scale steps), change which shapes a section may use |
| `data/section-harmony.json` | Change which chords a section plays over the progression |
| `data/song-forms.json` | Change the forms, how far each part can repeat, how the Length slider grows a song, or a repeat's variation |
| `data/energy.json` | Reweight what makes a section feel bigger |
| `data/playability.json` | Change the speed limit, the downpick caps, or what makes a section rate harder |
| `data/critic.json` | Change how many takes a build writes, or what the critic likes in a song |
| `data/lead-rules.json` | Change the melodic taste (steps vs leaps, chord notes on strong beats, the solo's arc, bends) |
| `data/lead-rhythms.json` | Add rhythm cells for melodies and solos |

After tuning, run `npm run verify`. If a reference output changes, regenerate it with `npx tsx scripts/verify-voicings.ts --update-fixtures` (chords) or `npx tsx scripts/verify-melody.ts --update-fixtures` (leads), and hand-check the diff. Then listen in `docs/mockups/expert-voicings.html` and `docs/mockups/melody-and-solo.html`.
