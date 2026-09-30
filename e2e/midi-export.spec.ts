import { readFileSync } from "node:fs";
import { type Page } from "@playwright/test";
import { notesOf, parseMidi } from "../lib/midi";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { lastPlayback, section } from "./helpers";

// The MIDI export (docs/song-builder-prd.md B9, §7): a type-1 .mid with a track per lane and GM drums, markers
// where each part starts, the song's tempo, and guitars that play exactly what the page plays.
const TRACKS = ["Sub", "Bass", "Piano left hand", "Rhythm guitar", "Lead vocal (guide)", "Piano right hand", "Pads / strings", "Lead guitar", "Synth leads, arps", "Drums"];
const PPQ = 480;
const BAR = PPQ * 4;

async function downloadMidi(page: Page) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "DOWNLOAD MIDI" }).click()]);
  return { name: file.suggestedFilename(), midi: parseMidi(new Uint8Array(readFileSync((await file.path())!))) };
}

test.describe("MIDI export", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
  });

  test("the file: a track per part, markers, tempo, and guitars that play what the page plays", async ({ page }) => {
    const title = (await page.locator("[data-song-header] h2").getAttribute("aria-label"))!;
    const { name, midi } = await downloadMidi(page);
    expect(name).toBe(`${title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-palm-mute.mid`);
    await expect(page.locator("[data-export='midi'] [role='status']")).toHaveText(`Saved ${name}.`);
    expect(midi.format).toBe(1);
    expect(midi.ppq).toBe(PPQ);
    expect(midi.tracks.slice(1).map((t) => t.name)).toEqual(TRACKS);
    // Tempo: Fast Punk, 180 BPM. Markers: one per part of the running order.
    const tempo = midi.tracks[0].events.find((e) => e.type === 0x51)!.data!;
    expect(Math.round(60_000_000 / ((tempo[0] << 16) | (tempo[1] << 8) | tempo[2]))).toBe(180);
    const parts = await page.getByRole("navigation", { name: "Song running order" }).getByRole("button").evaluateAll((els) =>
      els.map((e) => /^Play the song from (.+?) \(\d+:\d\d, (\d+) bars?/.exec(e.getAttribute("aria-label")!)!).map((m) => ({ name: m[1], bars: Number(m[2]) })),
    );
    const markers = midi.tracks[0].events.filter((e) => e.type === 0x06);
    expect(markers.map((m) => m.text)).toEqual(parts.map((p) => p.name));
    let at = 0;
    parts.forEach((p, i) => {
      expect(markers[i].tick).toBe(at * BAR);
      at += p.bars;
    });
    // The guitars are what PLAY SONG plays, strum for strum and note for note.
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    const pb = (await lastPlayback(page))!;
    await page.getByRole("button", { name: "STOP SONG" }).click();
    expect(pb.bars).toHaveLength(at);
    const strums = pb.bars.flatMap((bar, b) => bar.cells.flatMap((h, c) => (h ? h.notes.map((pitch) => `${b * BAR + (c * BAR) / bar.cells.length}:${pitch}`) : []))).sort();
    const rhythm = notesOf(midi.tracks[1 + TRACKS.indexOf("Rhythm guitar")]).map((n) => `${n.tick}:${n.pitch}`).sort();
    expect(rhythm).toEqual(strums);
    const leads = pb.bars.flatMap((bar, b) => (bar.lead ?? []).flatMap((h, c) => (h ? h.notes.map((pitch) => `${b * BAR + c * (PPQ / 2)}:${pitch}`) : []))).sort();
    expect(notesOf(midi.tracks[1 + TRACKS.indexOf("Lead guitar")]).map((n) => `${n.tick}:${n.pitch}`).sort()).toEqual(leads);
    // The other parts sit in their lanes (the owner's table).
    const lanes: Record<string, [number, number]> = { Sub: [24, 38], Bass: [36, 52], "Piano left hand": [43, 55], "Lead vocal (guide)": [57, 76], "Piano right hand": [67, 84], "Pads / strings": [72, 88], "Synth leads, arps": [76, 96] };
    for (const [track, [lo, hi]] of Object.entries(lanes)) {
      const notes = notesOf(midi.tracks[1 + TRACKS.indexOf(track)]);
      expect(notes.length, `${track} has notes`).toBeGreaterThan(0);
      for (const n of notes) expect(n.pitch >= lo && n.pitch <= hi, `${track} note ${n.pitch}`).toBe(true);
    }
  });

  test("without drums; and the Last chorus up a tone is marked", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Include drums" }).uncheck();
    await expect(page.locator("[data-export='midi']")).toContainText("9 tracks");
    let { midi } = await downloadMidi(page);
    expect(midi.tracks.slice(1).map((t) => t.name)).toEqual(TRACKS.slice(0, -1));
    await section(page, "Chorus").getByRole("button", { name: "Chorus options" }).click();
    await section(page, "Chorus").getByRole("tab", { name: /STRUCTURE/ }).click();
    await section(page, "Chorus").getByRole("radiogroup", { name: "Last chorus" }).getByRole("radio", { name: "UP A TONE" }).click();
    ({ midi } = await downloadMidi(page));
    expect(midi.tracks[0].events.filter((e) => e.type === 0x06).map((e) => e.text)).toContain("Last chorus (up a tone)");
  });
});
