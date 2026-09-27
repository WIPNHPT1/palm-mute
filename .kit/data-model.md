# Palm/Mute — Data Model & Generation Algorithm

Companion to `data/*.json`. This is the piece the static mockups couldn't show: how "Key of A" turns into 12 different keys' worth of real, correct tabs.

## 1. Core pipeline

```
User picks Key (12 options) + Feel (Fast Punk / Half-Time / Mid-Tempo)
        │
        ▼
resolveKeyToProgressionChords(key, progressionId)
  → for each degree in progression.degrees:
        rootPitchClass = (keyPitchClass + degreeOffsets[degree]) mod 12
        chord = chordLibrary[noteNameFor(rootPitchClass)]
        ▼
renderSectionTab(sectionTemplate, resolvedChords, feel)
  → produces the 6-line ASCII tab block + caption shown in each section card
        ▼
renderRhythmLane(feel) → pulls the matching pattern from rhythm-patterns.json
renderChordChips(progression, key) → pulls resolved chords + their twoNoteTab
```

Everything downstream of "Key + Feel + Progression" is a pure function of the JSON data files — no hand-authored per-key content needed.

## 2. Pitch-class helper (needed once, used everywhere)

```js
const PITCH_CLASSES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
// index 0-11, sharps as canonical names; use chordLibrary[x].enharmonic for flat display

function pitchClassOf(noteName) { return PITCH_CLASSES.indexOf(noteName); }
function noteNameFor(pitchClass) { return PITCH_CLASSES[((pitchClass % 12) + 12) % 12]; }
```

## 3. Resolving a progression in a key

```js
function resolveProgression(keyNoteName, progressionId) {
  const key = pitchClassOf(keyNoteName);
  const prog = progressions.find(p => p.id === progressionId);
  return prog.degrees.map(degree => {
    const rootPc = (key + degreeOffsets[degree]) % 12;
    return chordLibrary.chords[noteNameFor(rootPc)];
  });
}
```

This is the function that makes the Chords page, the Generator's Power Chords panel, and the Chorus section all correct for whatever key the user picks — none of it is hardcoded to A anymore.

## 4. Section rendering rules

See `data/song-section-templates.json` for the per-section shape. Two sections need special handling:

- **Chorus**: `degreeSequence: "USE_SELECTED_PROGRESSION"` — render the full resolved progression from step 3, one bar per chord, open (not muted).
- **Solo**: not a chord progression at all — it's a lead lick. Use the `leadLickFormula` in the template: compute `rootFretOnLowE = (keyPitchClass - 4 + 12) % 12`, then the e/B string tab is just that fret and fret+2, alternating. (This exactly reproduces the original mockup's `5,7,5,7` for Key of A, and generalizes correctly to all 12 keys.)

## 5. "Most Common / Brightest / Darkest" sort (Chords page)

`data/progressions.json.sortHeuristic` defines this. It's a **placeholder heuristic**, not music-theory-validated — flagging again here because it's the one piece of "logic" that's more editorial than mechanical. Fine to ship as-is; worth a sanity-check from an actual guitarist before calling it final.

## 6. Originality check (the "ORIGINALITY CHECK · PASS" badge)

The PRD raised this but never speced an algorithm. Recommended lightweight v1 approach — deliberately NOT a full audio-fingerprinting system, which is out of scope for a prototype:

1. Maintain a small **reference set** of well-known pop-punk riff *interval sequences* (not audio, not tab images — just the sequence of scale-degree movements, e.g. `[0, 5, 7, 9]` for a I-IV-V-vi feel) for maybe 15-20 iconic songs' verse/chorus progressions, sourced from public music-theory writeups (chord progressions themselves aren't copyrightable — this is about pattern novelty messaging, not legal clearance).
2. When a section is generated, compute its degree sequence the same way and compare against the reference set.
3. If it matches a known sequence exactly (or within a configurable tolerance, e.g. shares 3+ consecutive degrees), either re-roll a different progression for that section or flip the badge to a neutral "reference-formula" state rather than "PASS".
4. This is a **novelty-of-pattern check**, not a legal originality guarantee — the About page copy should stay carefully worded ("we generate from chord-degree and rhythm patterns only") rather than implying formal copyright clearance, which the existing About page copy already does well.

**Open decision for you to confirm**: is this lightweight pattern-matching approach sufficient for the prototype, or do you want the badge to just always show PASS for v1 (i.e., treat originality-checking as a v2 feature and keep the badge as a design/marketing element only)? Either is reasonable for a prototype — I'd default to **always-PASS for v1** unless you want the real check built now, since the reference-set curation is the only genuinely time-consuming part of this whole kit.

## 7. Audio playback data requirements

Whatever audio approach is chosen (see `tech-stack.md`), it needs from this data model:
- A note name + octave for each fretted position (guitar samples are usually mapped by MIDI note, not fret/string) — trivial to derive: `midiNote = openStringMidi[string] + fret`.
- The rhythm pattern glyph arrays already double as a step-sequencer input (▼/▲/· → note-on/note-on/rest).
- The feel/tempo split in `feels.json` maps directly to two independent audio-clock concerns: master BPM, and which drum pattern loops against it.
