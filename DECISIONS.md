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
| Navigation | **Hamburger menu at every size** — overrides the mockups' inline desktop/tablet links; the mobile inline link row under the header stays | Repo owner, 2026-09-27 |

## Notes on the owner calls

- **Dark mode:** the dark palette lives next to the light one in `tailwind.config.js` and is emitted
  as CSS variables (`:root` / `.dark`). The toggle stores an explicit choice in `localStorage`;
  with no stored choice it follows the OS `prefers-color-scheme`. The mockups have no dark
  designs, so the dark palette is an in-house interpretation of the tape-deck look — worth a
  design pass.
- **Solo variations:** seed 0 is still the template lick (`5,7,5,7` in A). Regenerating writes a
  6–7 note phrase from the key's major pentatonic within frets r-1…r+3 on the G/B/e strings,
  always ending on the root. See `leadLick` in `lib/generator.ts`.
