# Palm/Mute — Interaction & State Spec

Ties `component-spec.md` (what things look like) to `data-model.md` (how the data resolves) into actual app behavior. Written so Claude Code can implement it without guessing at edge cases.

## 1. Global app state (Generator page)

```ts
type GeneratorState = {
  key: NoteName;                 // one of the 12 pitch classes, default "A"
  feel: "fast-punk" | "half-time" | "mid-tempo";  // default "fast-punk"
  midTempoBpm: number;           // 120-150, default 140 — only relevant when feel === "mid-tempo"
  progressionId: string;         // which of the 6 progressions backs the Chorus + Power Chords panel, default "I-V-vi-IV"
  sections: {
    [sectionId in "intro"|"verse"|"chorus"|"solo"|"breakdown"]: {
      locked: boolean;           // default: verse=true, all others false
      seed: number;              // regeneration seed, so "regenerate" produces a *different* variation, not a no-op
    }
  };
  originalityStatus: "pass" | "flagged"; // see data-model.md §6
};
```

## 2. Event → effect table

| Control | Event | Effect |
|---|---|---|
| Key pill | click | `state.key = clickedKey`; re-resolve chords for Power Chords panel, Rhythm Lane, and every **unlocked** section. Locked sections keep their current tab (a locked Verse should NOT silently change key underneath the user — flag this as a UX decision: either (a) locked sections stay frozen even across key changes, or (b) key changes always re-render everything and "locked" only blocks the Generate button/regenerate icon. **Recommend (a)** — locking should mean "don't touch this," full stop. |
| Feel segment | click | `state.feel = clicked`; re-render Rhythm Lane pattern + all unlocked sections' strum notation; if switching to Mid-Tempo, reveal the tempo stepper (see `feels.json.uiRequirement`) |
| Mid-Tempo stepper | drag/click | `state.midTempoBpm = value`; only affects playback speed, not chord content |
| Generate button | click | Re-seed and re-render every **unlocked** section + re-run the originality check; does NOT touch locked sections |
| Section regenerate icon | click | Re-seed and re-render **that section only**; no-op / disabled if section is locked |
| Section lock icon | click | Toggle `sections[id].locked`; update icon color per `component-spec.md` §2 (Section cards) |
| Chords page Sort segment | click | Re-sort the 6 progression cards per `progressions.json.sortHeuristic` — does not change chord content, just card order |
| Chords/Generator progression play icon | click | Sets that progression/chip as the "currently playing" one (fills the icon) and starts audio playback (see `tech-stack.md` for the audio approach) |
| "Stuck on a song title?" shuffle (implied by the copy) | click | Re-roll from `data/title-generator.json`, avoiding immediate repeat |
| Dark-mode toggle | click | **[OPEN DECISION]** — no dark theme exists yet. Recommend scoping this OUT of v1: either disable the control (grayed out, tooltip "coming soon") or wire it to a no-op. Building a full second theme is real design work, not a data-wiring task. |

## 3. Regeneration semantics ("what does a different seed actually change?")

For sections built from `degreeSequence` templates (Intro, Verse, Breakdown), there's only one correct chord per degree — regeneration should vary **rhythmic phrasing** (e.g. which eighth-notes are muted, minor variations in the pattern), not the chord choices themselves, since the chords are theory-correct for the key. For the Chorus, regeneration can reasonably **swap which of the 6 progressions** backs it (cycling through `progressions.json`). For the Solo, regeneration can shift the lead lick's rhythmic pattern (still root/root+2, but vary note order/timing) — changing the actual notes isn't really necessary since the simplified 2-note lick has limited room for variation; **a real "solo variation" system is a good v2 feature, not a v1 requirement.**

## 4. Chords page vs. Generator page relationship

They currently read as two separate flows. Recommend: selecting a key on one page and navigating to the other should preserve the key selection (shared state, e.g. URL query param `?key=A` or a small global store) — small thing, but it's the difference between the app feeling coherent vs. two disconnected demos.

## 5. Empty/error states not shown in the mockups

The mockups only show the "happy path" (a key always selected, chords always resolved). Two things Claude Code should still handle:
- **Nothing selected yet on first load** — recommend defaulting to Key of A / Fast Punk / I-V-vi-IV, exactly matching the mockups, so the first paint looks identical to the design.
- **Playback failure** (audio context blocked until user gesture, common in browsers) — the play icon should silently no-op until a click unlocks audio, not throw.
