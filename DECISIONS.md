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
| Navigation | **Hamburger menu at every size** — overrides the mockups' inline desktop/tablet links. The mockups' mobile link row under the header was also removed, since the menu covers navigation everywhere | Repo owner, 2026-09-27 |
| Menu style | **"Shutter" full-screen menu**: one full-width band per page wiping in from the left, red flood on hover/keyboard focus, bottom strip with dark toggle + GitHub. The top bar is sticky so the close button is always reachable. Picked from six mock-ups | Repo owner, 2026-09-27 |
| Wordmark | **Lightning bolt in place of the "/"**, flipping like a coin every ~3.5s ("Coin Flip"); still for reduced-motion users; screen readers hear "Palm/Mute" | Repo owner, 2026-09-27 |
| Home page | **"Count In"** at `/`: the Soundcheck design picked from three mock-ups, carrying the old About content (no em dashes; originality wording softened to what the site actually does). Generator moved to `/generator/`; `/about/` permanently redirects to `/` (netlify.toml, plus a client-side fallback page); menu is Count In · Generator · Chords | Repo owner, 2026-09-27 |
| Home headline | Font size fitted to the widest line so nothing clips; designed line breaks (6 lines under 834px, 4 above); lines start on their margins and scroll motion stays within each line's free space | Repo owner, 2026-09-27 |
| Power-chord diagram | Shows **G5** as the chord library voices it (E string 3rd fret + A string 5th fret), both notes fretted and joined, ✕ on the four muted strings, text legend | Repo owner, 2026-09-27 |
| Song titles | **90 hand-written titles** (approved list), no "(… Mix)" suffix, each ≤ 22 characters so the split-flap board always shows one line (letters fitted to the title, 13px minimum on a 320px phone, 34px max). **Shuffle bag**: no title repeats until all 90 have been shown; one deck per visit | Repo owner, 2026-09-27 |

## Notes on the owner calls

- **Dark mode:** the dark palette lives next to the light one in `tailwind.config.js` and is emitted
  as CSS variables (`:root` / `.dark`). The toggle stores an explicit choice in `localStorage`;
  with no stored choice it follows the OS `prefers-color-scheme`. The mockups have no dark
  designs, so the dark palette is an in-house interpretation of the tape-deck look — worth a
  design pass.
- **Solo variations:** seed 0 is still the template lick (`5,7,5,7` in A). Regenerating writes a
  6–7 note phrase from the key's major pentatonic within frets r-1…r+3 on the G/B/e strings,
  always ending on the root. See `leadLick` in `lib/generator.ts`.
