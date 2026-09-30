// Song critic and best-of-N (docs/song-engine-v2-prd.md R17–R19, data/critic.json). Part of `npm run verify`.
// Sampled: 12 keys × 10 progressions × 5 feels × 1 song seed (every take of every song is rendered in full,
// and the per-section sweep in verify-voicings already covers every seed of every section).
import assert from "node:assert/strict";
import { CRITIC, type Fixed, bestSectionTake, bestSong, critique, renderSong, takeSeeds } from "@/lib/critic";
import { FEEL_IDS, type SectionInputs, renderSection } from "@/lib/generator";
import { PITCH_CLASSES, progressions } from "@/lib/musicTheory";
import { type SectionId, SECTION_IDS } from "@/lib/songPlan";

const N = CRITIC.candidates;
const SONG_SEEDS = 1;
let songs = 0;
let gain = 0;
let takeZeroWins = 0;
const parts: Record<string, number> = {};
let worst = Infinity, best = -Infinity;
const t0 = performance.now();

const tabOf = (id: SectionId, inputs: SectionInputs) => JSON.stringify(renderSection(id, inputs).tab);
const inputsOf = (base: { key: (typeof PITCH_CLASSES)[number]; feel: (typeof FEEL_IDS)[number]; progressionId: string }, seeds: Record<SectionId, number>) =>
  Object.fromEntries(SECTION_IDS.map((id) => [id, { ...base, seed: seeds[id], lead: null }])) as Record<SectionId, SectionInputs>;

for (const key of PITCH_CLASSES)
  for (const p of progressions)
    for (const feel of FEEL_IDS)
      for (let songSeed = 0; songSeed < SONG_SEEDS; songSeed++) {
        const base = { key, feel, progressionId: p.id };
        const where = `${key} ${p.id} ${feel} song ${songSeed}`;
        const pick = bestSong(base, songSeed);
        songs++;
        // R18: N takes scored, the best kept, deterministically.
        assert.equal(pick.scores.length, N, `${where}: ${pick.scores.length} takes scored`);
        assert.ok(pick.scores.every((s) => s <= pick.score.total + 1e-9), `${where}: a take beat the kept one`);
        assert.deepEqual(bestSong(base, songSeed).seeds, pick.seeds, `${where}: same song seed, different song`);
        assert.equal(critique(renderSong(inputsOf(base, pick.seeds))).total, pick.score.total, `${where}: the kept score isn't the song's`);
        if (songSeed === 0) assert.deepEqual(takeSeeds(0, 0), Object.fromEntries(SECTION_IDS.map((id) => [id, 0])), "song 0's first take is every section's own best");
        gain += pick.score.total - pick.scores[0];
        if (pick.score.total === pick.scores[0]) takeZeroWins++;
        worst = Math.min(worst, pick.score.total);
        best = Math.max(best, pick.score.total);
        for (const [k, v] of Object.entries(pick.score.parts)) parts[k] = (parts[k] ?? 0) + v;
        // R8 still holds for the kept song.
        const song = renderSong(inputsOf(base, pick.seeds));
        assert.ok(song.chorus.energy > song.verse.energy, `${where}: kept song's chorus isn't its peak`);

        if (songSeed !== 0 || feel !== "fast-punk") continue;
        // Locked sections never move: fix the Verse and the Chorus at other takes, and a new song keeps them.
        const fixed: Fixed = { verse: { ...base, seed: 5, lead: null }, chorus: { ...base, seed: 3, lead: null } };
        const withLocks = bestSong(base, 1, fixed);
        assert.equal(withLocks.seeds.verse, 5, `${where}: GENERATE moved a locked Verse`);
        assert.equal(withLocks.seeds.chorus, 3, `${where}: GENERATE moved a locked Chorus`);
        // GENERATE always writes something new when it can: avoiding the song on screen changes a free section.
        const next = bestSong(base, 1, {}, pick.seeds);
        assert.ok(SECTION_IDS.some((id) => id !== "solo" && next.seeds[id] !== pick.seeds[id]), `${where}: GENERATE repeated the song on screen`);
        // R19: a section's ↻ changes that section, audibly, and nothing else.
        const inputs = inputsOf(base, pick.seeds);
        for (const id of ["intro", "verse", "prechorus", "chorus", "breakdown", "ending"] as const) {
          const seed = bestSectionTake(id, inputs);
          assert.notEqual(tabOf(id, { ...inputs[id], seed }), tabOf(id, inputs[id]), `${where}: ↻ ${id} is a no-op`);
          assert.equal(bestSectionTake(id, inputs), seed, `${where}: ↻ ${id} isn't deterministic`);
        }
      }

const ms = (performance.now() - t0) / songs;
const mean = (k: string) => (parts[k] / songs).toFixed(2);
console.log(
  `\nSong critic: ${songs} songs × ${N} takes (12 keys × ${progressions.length} progressions × ${FEEL_IDS.length} feels × ${SONG_SEEDS} song seeds); ` +
    `kept scores ${worst.toFixed(2)} to ${best.toFixed(2)}; best of ${N} beats take 1 by ${(gain / songs).toFixed(2)} on average (take 1 kept in ${takeZeroWins}). ` +
    `Mean parts: playability ${mean("playability")}, arc ${mean("arc")}, hook ${mean("hook")}, variety ${mean("variety")}, flow ${mean("flow")}. ` +
    `About ${ms.toFixed(1)} ms of checks per song in Node.`,
);
console.log("All critic checks passed.");
