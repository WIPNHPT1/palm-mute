"use client";

import { useState } from "react";
import { LANES, fileName, midiFile } from "@/lib/arrange";
import type { NoteName } from "@/lib/musicTheory";
import type { Song } from "@/lib/song";

/** The lanes' piano roll runs from C1 (24) to C7 (96). */
const LO = 24;
const HI = 96;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

/** Hands a file to the browser to save (the export buttons). */
export function download(bytes: Uint8Array | Blob, name: string, type: string) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * MIDI export (docs/song-builder-prd.md §7): one .mid with a track per part in the owner's lane table and
 * General MIDI drums, section markers, tempo and key. The table shows each part's range on a piano roll;
 * the guitars are at concert pitch.
 */
export function MidiExportCard({ song, bpm, keyName, progressionId, title }: { song: Song; bpm: number; keyName: NoteName; progressionId: string; title: string }) {
  const [drums, setDrums] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const save = () => {
    const name = fileName(title, "mid");
    download(midiFile({ song, bpm, key: keyName, progressionId, title, drums }), name, "audio/midi");
    setSaved(name);
  };
  const tracks = LANES.filter((l) => l.id !== "drums" || drums).length;
  return (
    <div data-export="midi" className="flex min-w-0 flex-col gap-[12px] rounded-outer border border-line bg-surface px-[16px] py-[14px] shadow-card tablet:px-[18px] tablet:py-[16px]">
      <h3 className="m-0 font-display text-[17px] leading-[1.3]">MIDI arrangement</h3>
      <p className="m-0 max-w-[62ch] font-mono text-[12px] leading-[1.6] text-text-muted">
        One .mid file with a track per part, section markers, tempo and key. Drop it into your DAW and every part is already in its own range. The guitars play
        exactly what the tabs show, at concert pitch.
      </p>
      {/* The piano-roll column shows from 400px up; on the narrowest phones the ranges say it in words. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[12px] tabular-nums">
          <caption className="sr-only">MIDI tracks and their note ranges</caption>
          <thead>
            <tr className="text-left text-text-faint">
              <th scope="col" className="pb-[6px] pr-[8px] font-normal uppercase tracking-[0.08em]">Track</th>
              <th scope="col" className="pb-[6px] pr-[8px] font-normal uppercase tracking-[0.08em]">Notes</th>
              <th scope="col" className="hidden w-[40%] min-w-[110px] pb-[6px] font-normal uppercase tracking-[0.08em] min-[400px]:table-cell">
                <span aria-hidden="true">C1 to C7</span>
                <span className="sr-only">Range on a piano roll from C1 to C7</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {LANES.filter((l) => l.id !== "drums" || drums).map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="py-[5px] pr-[8px] text-text-primary">{l.name}</td>
                <td className="whitespace-nowrap py-[5px] pr-[8px] text-text-secondary">
                  {l.id === "drums" ? "Channel 10" : l.concert ? "Concert pitch" : `${noteName(l.lo!)}–${noteName(l.hi!)}`}
                </td>
                <td className="hidden py-[5px] min-[400px]:table-cell">
                  {l.lo !== undefined && !l.concert ? (
                    <div className="relative h-[8px] rounded-[4px] bg-paper" aria-hidden="true">
                      <span className="absolute inset-y-0 rounded-[4px] bg-text-faint" style={{ left: `${((l.lo - LO) / (HI - LO)) * 100}%`, width: `${((l.hi! - l.lo) / (HI - LO)) * 100}%` }} />
                    </div>
                  ) : l.concert ? (
                    <div className="relative h-[8px] rounded-[4px] bg-paper" aria-hidden="true">
                      {/* E standard: low E (40) to the 15th fret on the high E (79) */}
                      <span className="absolute inset-y-0 rounded-[4px] bg-accent" style={{ left: `${((40 - LO) / (HI - LO)) * 100}%`, width: `${((79 - 40) / (HI - LO)) * 100}%` }} />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-[10px]">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-[2px] pr-[6px] font-mono text-[12px] text-text-muted">
          {/* The real checkbox is the whole 44px square (a tap target); the box inside is drawn. */}
          <span className="relative flex h-[44px] w-[44px] shrink-0 items-center justify-center">
            <input type="checkbox" checked={drums} onChange={(e) => setDrums(e.target.checked)} className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <span
              aria-hidden="true"
              className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border-[1.5px] border-text-muted text-text-on-accent peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            >
              {drums && (
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M3 8.5l3.2 3L13 4.5" />
                </svg>
              )}
            </span>
          </span>
          Include drums
        </label>
        <span className="font-mono text-[12px] text-text-faint">{tracks} tracks</span>
        <button
          type="button"
          onClick={save}
          className="ml-auto flex min-h-[48px] items-center justify-center gap-[9px] rounded-outer bg-accent px-[20px] py-[12px] font-display text-[12.5px] text-text-on-accent shadow-button transition-transform active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
          </svg>
          DOWNLOAD MIDI
        </button>
      </div>
      <p className="m-0 min-h-[1.6em] font-mono text-[12px] text-text-faint" role="status">
        {saved ? `Saved ${saved}.` : ""}
      </p>
    </div>
  );
}
