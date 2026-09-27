# Mockup source (raw)

These are the original `.dc.html` component files from the Palm/Mute responsive design artifact, plus the `canvas.json` board index that lays them out. They're included for reference only — e.g. if you want to see exactly how a value like the `{{accent}}` token or a regenerate-icon state was authored, or if you ever pull this canvas back into Claude's Design tool to keep iterating on the visual design.

**Don't build from these directly.** They depend on the Claude artifact runtime (`support.js`, the `<x-dc>` custom element, `{{hole}}` templating) which isn't available outside that tool. For a build reference that opens in any browser, use `../mockups/` instead — those are the same 9 pages flattened to plain static HTML.

| File | Page | Breakpoint |
|---|---|---|
| `Main.dc.html` | Song Generator | Desktop (1440×960) |
| `GeneratorTablet.dc.html` | Song Generator | Tablet (834×~1780) |
| `GeneratorMobile.dc.html` | Song Generator | Mobile (390×~2040) |
| `ChordsDesktop.dc.html` | Chords | Desktop (1440×960) |
| `ChordsTablet.dc.html` | Chords | Tablet (834×~1620) |
| `ChordsMobile.dc.html` | Chords | Mobile (390×~2160) |
| `AboutDesktop.dc.html` | About | Desktop (1440×960) |
| `AboutTablet.dc.html` | About | Tablet (834×~1560) |
| `AboutMobile.dc.html` | About | Mobile (390×~2100) |
| `canvas.json` | — | board index (x/y/w/h layout) |

Live artifact (editable, if you have access): `https://claude.ai/artifact/GjDJD8xsPpfHVwsC38N8qN`
