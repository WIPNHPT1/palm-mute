# Palm/Mute — Target Repo Structure

```
palm-mute/
├── netlify.toml                  (from this kit)
├── next.config.js                (from this kit)
├── tailwind.config.js            (from this kit)
├── package.json                  (from this kit)
├── tsconfig.json                 (standard Next.js TS config — Claude Code generates via `npx create-next-app` conventions)
├── data/                         (from this kit, copied as-is)
│   ├── chord-library.json
│   ├── progressions.json
│   ├── rhythm-patterns.json
│   ├── feels.json
│   ├── song-section-templates.json
│   └── title-generator.json
├── app/
│   ├── layout.tsx                 (nav, fonts, global providers)
│   ├── page.tsx                   (Song Generator — the default route)
│   ├── chords/
│   │   └── page.tsx
│   ├── about/
│   │   └── page.tsx
│   └── globals.css                (Tailwind base + any non-utility CSS)
├── components/
│   ├── Nav.tsx
│   ├── KeyPicker.tsx               (shared: Generator + Chords pages)
│   ├── FeelToggle.tsx              (Generator page; Sort toggle on Chords is a variant — consider one SegmentedControl.tsx used by both)
│   ├── SegmentedControl.tsx
│   ├── GenerateButton.tsx
│   ├── SectionCard.tsx             (Intro/Verse/Chorus/Solo/Breakdown)
│   ├── ChordChip.tsx               (the 6-string mini tab chip, used in Power Chords panel + Chords page)
│   ├── ProgressionRow.tsx          (wraps a set of ChordChips + play icon + waveform icon)
│   ├── RhythmLane.tsx
│   ├── TabBlock.tsx                (renders the 6-line ASCII tab from resolved fret data)
│   └── icons/                      (one file per inline SVG icon — regenerate, lock, play, hamburger, shuffle)
├── lib/
│   ├── musicTheory.ts              (pitchClassOf, noteNameFor, resolveProgression — from data-model.md §2-4)
│   ├── generator.ts                (renderSectionTab, renderRhythmLane, regeneration/seed logic — from interaction-spec.md)
│   ├── originalityCheck.ts         (from data-model.md §6 — or a stub returning "pass" if you scope the real check to v2)
│   └── audio/
│       ├── engine.ts               (Tone.js setup: Transport, sampler, drum sequencer)
│       └── samples/                (guitar + drum one-shot audio files — see tech-stack.md)
├── context/
│   └── GeneratorContext.tsx        (the state shape from interaction-spec.md §1)
└── public/
    └── (any static assets — should stay nearly empty per component-spec.md's "no images anywhere" note)
```

## Notes for Claude Code
- `data/` is the single source of truth for content — components should import and render it, never hardcode chord/tab strings.
- Everything under `lib/` should be plain functions with no React dependency, so they're independently testable.
- Keep the design-token → Tailwind mapping (`tailwind.config.js`) as the only place hex values live; components should use Tailwind classes, not inline styles (the mockups use inline styles because that's what the design-tool format requires — the real build should not carry that pattern over).
