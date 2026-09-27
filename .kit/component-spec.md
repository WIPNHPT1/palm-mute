# Palm/Mute — Component & Layout Spec
Extracted from the "Palm/Mute — Responsive Page Set" design artifact (9 mockups: Generator / Chords / About × Desktop / Tablet / Mobile). Pair this with `design-tokens.json` for exact colors, type, spacing, radii, shadows and icon rules.

Use this as the authoritative behavior/layout spec when building the real components — the mockups are static, so anything marked **[LOGIC NEEDED]** has no real data/behavior behind it yet and is covered separately in the data-model doc.

---

## 1. Global chrome

### Nav bar
- Desktop/Tablet: dark bar (`ink` bg), height 76px, horizontal padding 56px (desktop) / 32px (tablet). Logo left ("PALM/MUTE" with accent-colored `/`), 3 nav links (Generator, Chords, About) with the active link in accent color, dark-mode toggle pill on the right.
- Mobile: height 64px, padding 20px. Logo left, hamburger icon right (no visible link row in the collapsed state — **[LOGIC NEEDED]**: hamburger must open a menu/drawer containing the 3 nav links + dark toggle; mockup shows the nav links as a small row directly under the header instead, which is a reasonable inline fallback if you skip a drawer).
- Active page indicated by accent-colored link text — no underline/pill.

### Page container
- Desktop: fixed 1440×960, `overflow: hidden` (single "screen" — real build should NOT clip like this; treat 960 as a min-height/viewport target, not a hard clip).
- Tablet/Mobile: fluid width, natural scrolling height (mockups use `expand:"fill"`, i.e. no clipping) — build these as normal scrollable pages.

---

## 2. Song Generator page

### Header
- Kicker ("SONGWRITING ENGINE") + Display title ("SONG GENERATOR") left; "ORIGINALITY CHECK · PASS" pill badge right (desktop/tablet only — dropped to a smaller inline badge under the title on mobile).
- **[LOGIC NEEDED]**: the pill's PASS state should reflect whether the last generation cleared the originality check.

### Key selector card
- White card, 12 pills (one per chromatic key: A, A#/Bb, B, C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab), 34×27px each.
- Naturals show a single letter; sharps/flats show a stacked two-line label (e.g. "A#" / "Bb").
- Selected key: `ink` background, `accent` text. Unselected: `paper` background, `line` border, `muted` text.
- Desktop/tablet: single row, `flex-wrap: wrap` as a safety net. Mobile: wraps to 2 rows by design (34px pills don't fit 12-wide at 390px).
- **[LOGIC NEEDED]**: clicking a pill sets the active key and re-derives all chord/tab data on the page.

### Feel toggle card
- Segmented control, 3 options: FAST PUNK (180 BPM), HALF-TIME (90 BPM), MID-TEMPO (140 BPM). Active segment: `ink` background, `paper` text; inactive: transparent, `muted` text.
- **[LOGIC NEEDED — flagged in the earlier PRD discussion]**: Fast Punk and Half-Time are the *same* master tempo (180 BPM) with two different drum feel templates; Mid-Tempo is a genuinely separate, independently adjustable tempo (default 140, range ~120–150). The UI currently shows a fixed "140 BPM" label for Mid-Tempo — the real build needs either a tempo stepper/slider that appears when Mid-Tempo is selected, or at minimum the BPM value must be wired to actual playback, not a static label.

### Generate button
- Desktop/tablet: pill button, icon + "GENERATE" label, `accent` background, positioned at the end of the Feel row (`margin-left: auto`).
- Mobile: full-width button, same content, own row below Feel.
- **[LOGIC NEEDED]**: triggers full-page regeneration (all 5 unlocked sections) using current Key + Feel.

### Section cards (Intro / Verse / Chorus / Solo / Breakdown)
- Grid: 5 columns (desktop) → 2 columns (tablet, 5th card spans full width) → 1 column (mobile).
- Each card: numeral ("01"–"05", accent-colored for the first/active-looking one, muted for others — **this numeral coloring in the mockup is cosmetic only, not a real "current step" indicator**), section label, a **pair** of icons top-right (regenerate + lock — added in the latest revision), a 6-line monospace tab block (`e|B|G|D|A|E` string rows), and a caption line (e.g. "4 bars · palm-muted").
- Chorus card is visually highlighted (accent border + colored shadow) in every mockup — **[LOGIC NEEDED]**: decide whether this highlight is permanent design flair for the chorus specifically, or should move to whichever section was most recently regenerated / is "hero" for the current key.
- Lock icon: dark/active (`ink` stroke) when the section is locked (Verse, in the mockups); muted (`#B5AA92`) otherwise. Regenerate icon: muted, always visible; disabled/no-op when the section is locked.
- **[LOGIC NEEDED]**: regenerate icon reruns generation for just that section; lock icon toggles a locked flag that (a) excludes the section from "Generate all" and (b) visually swaps its regenerate icon to a disabled state.
- Tab block content is currently hardcoded per section per mockup — real build needs this driven by the data model (see data-model doc) keyed on Key × Feel × section.

### Power Chords panel
- Header ("POWER CHORDS" + "Best progressions · Key of [X] · E standard").
- 3 progression rows (desktop/tablet) — each row: a tiny 4-bar waveform/bar icon, the Roman-numeral progression name, a horizontal row of chord chips (each chip: chord name + full 6-string tab, `e/B/G/D/A/E` one string per line), and a play icon (filled = "currently playing/selected" progression, outlined = alternate).
- Mobile: same content, reflowed into vertical mini-cards (icon+label+play icon on top, chips wrapping below) since 4 chips no longer fit one row at 390px.
- **[LOGIC NEEDED]**: progression list, chip tab data, and the play icon must all be driven by the Key selection — currently hardcoded to "Key of A".

### Rhythm Lane panel
- Desktop: 3 stacked rows. Tablet: reflowed to a 3-column grid (fits comfortably at 834px). Mobile: stacked single column.
- Each entry: pattern name, a feel tag chip (FAST PUNK / HALF-TIME / MID-TEMPO, each with its own tag color), a strum-glyph line (▼▲· characters), a beat-count line, and a one-line description.
- **[LOGIC NEEDED]**: same data-binding gap as Power Chords — content is static per mockup, needs to be generated from Key + Feel.

---

## 3. Chords page

- Header: kicker + "CHORDS" title, no supporting paragraph (removed per latest revision).
- Key card: identical component/behavior to the Generator page's Key card.
- Sort control: same segmented-control component as Feel, but 3 different options (MOST COMMON / BRIGHTEST / DARKEST) — **[LOGIC NEEDED]**: defines the sort order of the progression list below; "brightest/darkest" implies a major/minor-brightness heuristic per progression that doesn't exist yet.
- Progression list: 6 cards (vs. 3 on the Generator page) — same chip/tab/play-icon component as the Generator's Power Chords panel, just more of them and the first one pinned/highlighted as "recommended."
  - Desktop: 2×3 grid. Tablet: reflows to a single full-width column (2-col didn't leave enough room for 4 chord chips per row — this was a deliberate legibility call, not a scaling artifact). Mobile: single column, vertical mini-card layout (matches Generator's mobile Power Chords treatment).

---

## 4. About page

- Hero: kicker + display headline + one paragraph. No image/illustration.
- 3 numbered "how it works" step cards: Desktop = 3 columns; Tablet = reflows to single full-width column (text-heavy cards read poorly at ~250px in 3-col); Mobile = single column.
- Dark "originality promise" banner: full-width dark card, single paragraph. On mobile this splits into a small heading row (dot + bold label) plus a body paragraph rather than one run-on inline sentence, purely for line-length readability.
- Two "fun" cards (light "Did you know" + dark "Stuck on a song title?"): side-by-side on desktop/tablet (tablet still fits two ~360px cards), stacked on mobile.
  - **[LOGIC NEEDED]**: the "Stuck on a song title?" card implies a title-generator feature (a "shuffle" affordance is referenced in copy) — this needs its own small word-bank/template generator, separate from the song-structure generator.
- CTA row: "START WRITING" button → links to Generator page; "Browse the chord library →" text link → links to Chords page. Same on all breakpoints, full-width stacked on mobile.

---

## 5. Cross-cutting notes for the build

- **No images/illustrations anywhere** — every visual is CSS + inline SVG icons + monospace tab typography. Keeps the prototype dependency-light.
- **One icon set, one stroke width (1.75px)** used throughout — regenerate (circular-arrows), lock (padlock), play (triangle), song-title shuffle (same circular-arrows), hamburger (3 lines), waveform/bars (custom 4-bar div construction, not an SVG — fine to keep as divs or convert to a tiny inline SVG component).
- **Dark-mode toggle exists visually on every page but has no implemented dark theme** — **[LOGIC NEEDED]**: either wire an actual dark theme (would need a second token set) or scope it out of v1 and gray out / remove the control.
- **Color prop**: the mockups expose an editable accent swatch (rust/brass/forest/blue). Worth keeping as a CSS custom property (`--accent`) so this stays swappable without a rebuild.
