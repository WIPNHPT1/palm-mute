// Quick self-check for the lib/ data layer: `npm run verify`.
import assert from "node:assert/strict";
import { type Degree, PITCH_CLASSES, chordMidiNotes, resolveProgression, sortProgressions, progressions } from "@/lib/musicTheory";
import { tabText } from "@/lib/fretboard";
import { type SectionId, FEEL_IDS, SECTION_IDS, feels, nextSeed, patternForFeel, playbackBpm, recipes, renderSection, rhythmPatterns, sectionTemplates } from "@/lib/generator";
import { DEFAULT_FORM, FORM_IDS, formSlots, formSpec, sectionDegrees } from "@/lib/songPlan";
import { LENGTH, barSeconds, formatLength, planSong } from "@/lib/songLength";
import { PRESETS, PRESET_IDS, presetSectionOptions } from "@/lib/presets";
import { type SharedSong, decodeSong, encodeSong } from "@/lib/share";
import { TITLES as ALL_TITLES } from "@/lib/titleGenerator";
import formsJson from "@/data/song-forms.json";
import { progressionBars } from "@/lib/playback";
import { TITLES, MAX_TITLE_LENGTH, createTitleBag } from "@/lib/titleGenerator";

// The Solo is written by the lead engine now (scripts/verify-melody.ts checks it); the old
// "5,7,5,7" template lick was retired with it (docs/melody-and-solo-brief.md §9).
{
  const solo = renderSection("solo", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
  assert.ok(solo.lead && solo.lead.inputs.part === "solo" && solo.lead.inputs.bars === 8, "Solo uses the lead engine, 8 bars");
  console.log("Solo, key of A:\n" + tabText(solo.tab));
}

// Progressions resolve per key.
const names = (k: Parameters<typeof resolveProgression>[0]) => resolveProgression(k, "I-V-vi-IV").map((c) => c.name).join(" ");
assert.equal(names("A"), "A5 E5 F#5 D5");
assert.equal(names("C"), "C5 G5 A5 F5");
assert.equal(names("F#"), "F#5 C#5 D#5 B5");
assert.equal(names("D#"), "D#5 A#5 C5 G#5");
// Mockup mislabeled F#5 as A2/D4 — library says F#5 is E2/A4.
const fSharp = resolveProgression("A", "I-V-vi-IV")[2].chord;
assert.equal(fSharp.rootString, "E"); assert.equal(fSharp.rootFret, 2);
assert.deepEqual(chordMidiNotes(resolveProgression("A", "I-IV-V")[0].chord), [45, 52]); // A2 + E3

// Regenerate always changes something; feel changes the rhythm.
for (const id of ["intro", "verse", "chorus", "solo", "breakdown"] as const) {
  const inputs = { key: "G" as const, feel: "mid-tempo" as const, progressionId: "I-IV-V", seed: 0 };
  const a = renderSection(id, inputs);
  const b = renderSection(id, { ...inputs, seed: nextSeed(id, inputs) });
  assert.notEqual(tabText(a.tab), tabText(b.tab), id);
}
const fp = renderSection("verse", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
const ht = renderSection("verse", { key: "A", feel: "half-time", progressionId: "I-V-vi-IV", seed: 0 });
assert.notEqual(tabText(fp.tab), tabText(ht.tab));
// Five feels (owner's pick, DECISIONS.md): data, strums, tempos and a recipe rhythm everywhere.
assert.deepEqual(feels.map((f) => f.id), FEEL_IDS, "feels.json lists every feel, in Feel-control order");
assert.equal(rhythmPatterns.length, FEEL_IDS.length, "one Rhythm Lane strum per feel");
for (const f of FEEL_IDS) {
  const glyphs = patternForFeel(f).glyphs;
  assert.equal(glyphs.length, 8, `${f}: strum is one bar of eighths`);
  for (const [id, recipe] of Object.entries(recipes)) {
    if (id === "breakdown") continue; // always half-time
    for (const v of recipe.variants) {
      if (v.riff) continue; // intro riffs are written from scale steps, the same in every feel
      const r = v.rhythms[f] ?? v.rhythms.all;
      assert.ok(r, `${id} "${v.name}" has a ${f} rhythm`);
      for (const bar of r.bars) assert.match(bar, /^([DUx.-]{8}|[DUx.-]{16})$/, `${id} "${v.name}" ${f}: 8 or 16 cells`);
    }
  }
}
// Every feel has one fixed tempo (Mid-Tempo's slider was removed, DECISIONS.md).
assert.deepEqual(FEEL_IDS.map((f) => playbackBpm(f)), [180, 180, 140, 150, 80]);
{
  // The feel's recipe rhythm really changes the Verse, for every feel.
  const verses = FEEL_IDS.map((f) => tabText(renderSection("verse", { key: "A", feel: f, progressionId: "I-V-vi-IV", seed: 0 }).tab));
  assert.equal(new Set(verses).size, FEEL_IDS.length, "every feel plays a different Verse");
  // Progression rows: Ballad's downstrokes ring for a half note, open; Fast Punk stays palm-muted eighths.
  const ballad = progressionBars("A", "I-V-vi-IV", "ballad")[0].cells;
  assert.deepEqual(ballad.map((c) => c?.cells ?? 0), [4, 0, 0, 0, 4, 0, 0, 0]);
  assert.ok(ballad.every((c) => !c || !c.palmMuted), "Ballad rings open");
  const punk = progressionBars("A", "I-V-vi-IV", "fast-punk")[0].cells;
  assert.ok(punk.every((c) => c && c.cells === 1 && c.palmMuted), "Fast Punk: palm-muted eighths");
}
// Breakdown is forced half-time.
assert.equal(renderSection("breakdown", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 }).feel, "half-time");

// Sort re-orders without changing content.
assert.equal(progressions.length, 10);
assert.equal(new Set(progressions.map((p) => p.id)).size, 10, "progression ids are unique");
for (const p of progressions) assert.equal(p.id, p.degrees.join("-"), `${p.id}: id matches its degrees`);
assert.deepEqual(sortProgressions(progressions, "brightest").map((p) => p.brightness), [5, 5, 5, 4, 4, 4, 3, 3, 3, 2]);
assert.deepEqual(sortProgressions(progressions, "darkest").map((p) => p.brightness), [2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
const ids = (mode: Parameters<typeof sortProgressions>[1]) => sortProgressions(progressions, mode).map((p) => p.id);
// Simplest: fewest different chords, then the shorter loop (I-V-IV-V has only three different chords).
assert.deepEqual(ids("simplest").slice(0, 4), ["I-IV-V", "vi-V-IV", "I-V-IV", "I-V-IV-V"]);
assert.deepEqual(ids("home-start").slice(0, 5), ["I-V-vi-IV", "I-IV-V", "I-V-IV-V", "I-vi-IV-V", "I-IV-vi-V"]);
assert.deepEqual(ids("minor-start").slice(0, 2), ["vi-IV-I-V", "vi-V-IV"]);
for (const mode of ["most-common", "brightest", "darkest", "simplest", "home-start", "minor-start"] as const)
  assert.deepEqual([...ids(mode)].sort(), progressions.map((p) => p.id).sort(), `${mode} keeps every card`);

// Song titles: 90 unique, short enough for one line, no "(… Mix)" suffix, no em/en dashes.
assert.equal(TITLES.length, 90);
assert.equal(new Set(TITLES.map((t) => t.toLowerCase())).size, 90, "duplicate titles");
for (const t of TITLES) {
  assert.ok(t.length <= MAX_TITLE_LENGTH, `"${t}" is over ${MAX_TITLE_LENGTH} characters`);
  assert.ok(!/\(.*mix\)/i.test(t) && !/[\u2014\u2013]/.test(t), `"${t}" has a Mix suffix or a dash`);
}
// Shuffle bag: starts on titles[0]; every round of 90 shows each title once; no back-to-back repeats, even across rounds.
{
  const bag = createTitleBag();
  const shown = [bag.current()];
  for (let i = 0; i < 90 * 6 - 1; i++) shown.push(bag.next());
  assert.equal(shown[0], TITLES[0]);
  for (let r = 0; r < 6; r++) assert.equal(new Set(shown.slice(r * 90, r * 90 + 90)).size, 90, `round ${r + 1} repeats a title`);
  for (let i = 1; i < shown.length; i++) assert.notEqual(shown[i], shown[i - 1], `back-to-back repeat at ${i}`);
}

// Song Engine v2 plan (data/section-harmony.json, data/song-forms.json): every section has a template and a
// recipe (or is the lead Solo); every progression gets a plan for every chord section, using only its own
// chords plus the classic set; every form starts on the Intro, ends on the Ending, and plays every section.
for (const id of SECTION_IDS) {
  assert.ok(sectionTemplates.some((t) => t.id === id), `${id}: no template`);
  if (id !== "solo") assert.ok(recipes[id], `${id}: no recipe`);
}
assert.deepEqual(sectionTemplates.map((t) => t.id), SECTION_IDS, "templates list every section, in card order");
for (const p of progressions)
  for (const id of SECTION_IDS) {
    if (id === "solo") continue;
    const degrees = sectionDegrees(id, p.id);
    assert.ok(degrees.length >= 1 && degrees.length <= 4, `${p.id} ${id}: ${degrees.length} bars`);
    for (const d of degrees) assert.ok(["I", "IV", "V", "vi"].includes(d), `${p.id} ${id}: ${d} is outside the classic set`);
    if (id === "verse" || id === "chorus" || id === "intro") for (const d of degrees) assert.ok(p.degrees.includes(d), `${p.id} ${id}: ${d} isn't in the progression`);
  }
for (const form of FORM_IDS) {
  const slots = formSlots(form);
  assert.equal(slots[0].section, "intro", `${form} starts on the Intro`);
  assert.equal(slots.at(-1)!.section, "ending", `${form} ends on the Ending`);
  for (const id of SECTION_IDS) if (form === "standard" || id !== "prechorus") assert.ok(slots.some((s) => s.section === id), `${form} never plays ${id}`);
  assert.equal(new Set(slots.map((s) => s.name)).size, slots.length, `${form}: part names repeat`);
}
assert.equal(DEFAULT_FORM, "standard", "Standard is the default form (DECISIONS.md)");

// Song length (docs/song-builder-prd.md B2–B3): for every tempo the feels can play and every Length step,
// the plan lands within the tolerance of the target, unless even the shortest form at its minimum is
// longer (a 16-bar solo in a 2:30 ballad). Every part plays within its range; Standard is the default length's form.
{
  const material: Record<string, number> = { intro: 4, verse: 8, prechorus: 4, chorus: 4, breakdown: 4, ending: 1 };
  const tempos = [80, 120, 130, 140, 150, 180];
  let plans = 0, worst = 0;
  for (const bpm of tempos)
    for (let t = LENGTH.min; t <= LENGTH.max; t += LENGTH.step)
      for (const solo of [8, 16]) {
        const bars = (id: string) => (id === "solo" ? solo : material[id]);
        const plan = planSong(t, bpm, bars);
        const target = t / barSeconds(bpm);
        const miss = Math.abs(plan.bars - target);
        const shortest = Math.min(...FORM_IDS.map((f) => formSpec(f).reduce((a, s) => a + s.min * bars(s.section), 0)));
        assert.ok(miss <= formsJson.toleranceBars || (plan.bars === shortest && plan.bars > target), `${bpm} BPM, ${formatLength(t)}, ${solo}-bar solo: ${plan.bars} bars misses ${target.toFixed(1)} by ${miss.toFixed(1)}`);
        if (plan.bars !== shortest) worst = Math.max(worst, miss);
        const spec = formSpec(plan.form);
        plan.slots.forEach((s, i) => assert.ok(s.times >= spec[i].min && s.times <= spec[i].max, `${plan.form} ${s.name}: ${s.times} outside ${spec[i].min}–${spec[i].max}`));
        assert.equal(plan.bars, plan.slots.reduce((a, s) => a + s.times * bars(s.section), 0), "plan bars");
        assert.deepEqual(planSong(t, bpm, bars), plan, "the plan is deterministic");
        plans++;
      }
  assert.equal(planSong(LENGTH.default, 180, (id) => (id === "solo" ? 8 : material[id])).form, "standard", "the default length is a Standard song");
  console.log(`Song length: ${plans} plans (${tempos.length} tempos × ${(LENGTH.max - LENGTH.min) / LENGTH.step + 1} lengths × 8/16-bar solos) within ${formsJson.toleranceBars} bars; worst miss ${worst.toFixed(1)} bars.`);
}

// Song Engine v2 Phase 4 grooves (DECISIONS.md): at least 6 per section role in every feel (the Breakdown is
// always half-time; Intro riffs count for the Intro); every groove's drums and stops sit inside its bars.
for (const role of ["intro", "verse", "prechorus", "chorus", "breakdown"] as const) {
  for (const f of role === "breakdown" ? (["half-time"] as const) : FEEL_IDS)
    assert.ok(recipes[role].variants.filter((v) => v.riff || v.rhythms[f] || v.rhythms.all).length >= 6, `${role} has fewer than 6 grooves in ${f}`);
  for (const v of recipes[role].variants)
    for (const r of Object.values(v.rhythms)) {
      r!.bars.forEach((bar, b) => {
        const drums = r!.drums?.[b % r!.drums.length];
        for (const cells of Object.values(drums ?? {})) for (const c of cells as number[]) assert.ok(c >= 0 && c < bar.length, `${role} "${v.name}": drum on cell ${c} of a ${bar.length}-cell bar`);
        const stop = r!.stopCells?.[b % r!.stopCells.length];
        if (stop !== null && stop !== undefined) assert.ok(/[DUx]/.test(bar.slice(0, stop + 1)), `${role} "${v.name}": a stop before any hit`);
      });
      for (const acc of r!.accents ?? []) assert.ok(acc >= 0 && acc < 8, `${role} "${v.name}": accents are eighths (0–7)`);
    }
}
for (const v of recipes.intro.variants.filter((x) => x.riff)) {
  const riff = v.riff!;
  for (const bar of riff.bars) for (const [cell] of bar) assert.ok(cell >= 0 && cell < riff.grid, `intro "${v.name}": cell ${cell} outside a ${riff.grid}-cell bar`);
}

console.log("\nAll data-layer checks passed.");

// Style presets (data/style-presets.json): every groove they name exists in that section's recipe, their feels,
// progressions and lengths are real, and in every key each preset finds a playable groove for every section it
// names (its first choice, or a fallback).
for (const id of PRESET_IDS) {
  const p = PRESETS[id];
  assert.ok(FEEL_IDS.includes(p.feel), `${id}: feel ${p.feel}`);
  if (p.progressionId) assert.ok(progressions.some((x) => x.id === p.progressionId), `${id}: progression ${p.progressionId}`);
  assert.ok(p.lengthSec >= LENGTH.min && p.lengthSec <= LENGTH.max && (p.lengthSec - LENGTH.min) % LENGTH.step === 0, `${id}: length ${p.lengthSec}`);
  for (const [section, names] of Object.entries(p.grooves))
    for (const n of names!) assert.ok(recipes[section as Exclude<SectionId, "solo">].variants.some((v) => v.name === n), `${id}: ${section} has no groove "${n}"`);
  for (const key of PITCH_CLASSES) {
    const options = presetSectionOptions(p, () => ({ key, feel: p.feel, progressionId: p.progressionId ?? "I-V-vi-IV", seed: 0 }));
    for (const section of Object.keys(p.grooves)) assert.ok(options[section as SectionId].groove, `${id} in ${key}: no playable ${section} groove`);
  }
}
console.log(`Style presets: ${PRESET_IDS.length} (${PRESET_IDS.map((i) => PRESETS[i].label).join(", ")}) find a playable groove for every section they name, in every key.`);

// Share links (lib/share.ts): every song survives the trip through a link unchanged: setups across every key,
// feel and preset, each section's take, lead, options and thread, and locked sections with what they were
// locked in. Links that don't check out come back null or with the bad parts dropped, never throwing.
{
  let links = 0;
  const longest = { n: 0 };
  for (const k of PITCH_CLASSES)
    for (const f of FEEL_IDS) {
      const preset = PRESET_IDS[(links % (PRESET_IDS.length + 1)) - 1] ?? null;
      const sections = Object.fromEntries(
        SECTION_IDS.map((id, i) => {
          const options = id === "solo" ? {} : { groove: recipes[id].variants[i % recipes[id].variants.length].name, ...(id === "verse" ? { noPush: true, sound: "pm" as const } : {}), ...(id === "chorus" ? { keyUp: true, times: 3 } : {}) };
          const lead = id === "solo" ? { style: "shred" as const, bars: 16 } : id === "intro" && links % 2 ? { style: "hook" as const, bars: 8, sent: true } : null;
          const locked = id === "breakdown";
          const thread = id === "solo" ? { quote: { rhythm: "n-n-n.n.", intervals: [2, -2, 5], from: "the Intro riff" }, degrees: ["I", "V", "vi", "IV"] as Degree[], peakDegree: "vi" as Degree } : undefined;
          return [id, { seed: (links * 7 + i) % 40, lead, options, ...(thread ? { thread } : {}), locked, frozen: locked ? { key: "D" as const, feel: "half-time" as const, progressionId: "I-IV-V", seed: 11, lead: null, options: { drums: "none" as const }, difficulty: "beginner" as const } : null }];
        }),
      ) as SharedSong["sections"];
      const song: SharedSong = { key: k, feel: f, progressionId: progressions[links % progressions.length].id, lengthSec: LENGTH.min + LENGTH.step * (links % 13), difficulty: (["beginner", "intermediate", "advanced"] as const)[links % 3], preset, songSeed: links, title: ALL_TITLES[links % ALL_TITLES.length], sections };
      const link = encodeSong(song);
      longest.n = Math.max(longest.n, link.length);
      assert.deepEqual(decodeSong("#" + link), song, `${k} ${f}: the song changed through its link`);
      links++;
    }
  for (const bad of ["", "#song=", "#song=!!!", "#song=bm90IGpzb24", `#song=${Buffer.from(JSON.stringify({ v: 2 })).toString("base64url")}`]) assert.equal(decodeSong(bad), null, `"${bad}" should not open`);
  const odd = decodeSong(`#song=${Buffer.from(JSON.stringify({ v: 1, k: "G", f: "ballad", p: "I-IV-V", n: 9999, t: 5000, g: -4, s: { verse: { s: 1e12, o: { groove: "Moonwalk", times: 99, sound: "loud" } } } })).toString("base64url")}`)!;
  assert.equal(odd.lengthSec, LENGTH.default);
  assert.equal(odd.title, ALL_TITLES[0]);
  assert.deepEqual(odd.sections.verse, { seed: 0, lead: null, options: {}, locked: false, frozen: null });
  console.log(`Share links: ${links} songs (every key × feel, presets, leads, options, threads, a locked part) open unchanged from their links (longest ${longest.n} characters); broken and tampered links are refused or cleaned.`);
}

