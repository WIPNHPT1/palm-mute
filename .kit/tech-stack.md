# Palm/Mute — Tech Stack Decisions

These need to be locked before Claude Code starts, so it isn't making architecture calls mid-build. Each one is a reasonable default for "static-ish site + Netlify + minimum intervention" — flag any you want changed before kicking off the build.

## Framework: **Next.js (static export)**
- `output: "export"` — no server runtime needed, ships as static files, deploys to Netlify with zero backend config.
- Why not plain Vite+React: Next gives file-based routing for free (Generator/Chords/About map directly to `app/page.tsx`, `app/chords/page.tsx`, `app/about/page.tsx`), which matches the site's actual structure and needs no manual router setup.
- Why not a heavier full-stack Next deploy (SSR/API routes): nothing here needs a server — all "generation" is client-side computation over the JSON data files in this kit.

## Styling: **Tailwind CSS, with `design-tokens.json` values wired into `tailwind.config.js`**
- The token file already has clean primitives (color, spacing scale, radius tiers) — mapping them into Tailwind's theme means every component just uses `bg-ink`, `text-accent`, `rounded-outer`, etc., instead of repeating hex/px values, and any brand color swap (the mockup's accent-swatch prop) becomes a one-line config change.
- Fonts: same Google Fonts import as the mockups (Archivo Black, Space Grotesk, Space Mono) — load via `next/font/google` rather than a `<link>` tag for better load performance.

## Audio: **Tone.js**
- The mockups don't need a tab-file-import engine (no Guitar Pro/MusicXML parsing) — everything is generated from this kit's own JSON, so a full notation-rendering library like AlphaTab is more machinery than needed.
- Tone.js gives: a sampler for guitar power-chord playback (a handful of clean-electric-guitar note samples, pitch-shifted per fret via `midiNote = openStringMidi[string] + fret`), a `Tone.Sequence` for the drum backing patterns (kick/snare/hat one-shots triggered per the glyph arrays in `rhythm-patterns.json`), and one shared `Tone.Transport` for the master-tempo/feel-template split described in `feels.json`.
- Needs a small sample pack: 6-8 guitar note samples (one per string open, pitch-shifted covers the rest) + 3-4 drum hits (kick/snare/closed-hat/open-hat). Royalty-free sample packs (e.g. from freesound.org, properly licensed) are enough for a prototype — flag if you'd rather this be fully synthesized (no samples) for a smaller repo/simpler licensing.

## State management: **React Context + hooks, no external library**
- The state shape in `interaction-spec.md` is small and single-page-scoped — Redux/Zustand would be overkill. A `GeneratorProvider` context covering the shape in §1 of that doc is enough.

## Deployment: **Netlify, static export, connected to GitHub**
- `netlify.toml` (included in this kit) sets the build command and publish directory.
- Netlify's GitHub integration auto-deploys on push to `main` — no CI file strictly needed for a static export, though a minimal GitHub Actions lint/build check is included as a nice-to-have so broken builds get flagged before merge, not just at deploy time.

## What Claude Code should NOT need to ask about
Given the above, the only remaining judgment calls during the build are cosmetic/micro-decisions (exact Tailwind class names, component file splitting) — everything structural is decided here.
