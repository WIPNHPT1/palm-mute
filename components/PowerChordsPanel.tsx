"use client";

import { ProgressionRow } from "@/components/ProgressionRow";
import { type NoteName, keyDisplayName, progressions, resolveProgression } from "@/lib/musicTheory";

/** Generator's Power Chords panel: the Chorus progression first, then the next most common two. */
export function PowerChordsPanel({
  keyName,
  selectedId,
  playingId,
  onTogglePlay,
}: {
  keyName: NoteName;
  selectedId: string;
  playingId: string | null;
  onTogglePlay: (id: string) => void;
}) {
  const selected = progressions.find((p) => p.id === selectedId)!;
  const shown = [selected, ...progressions.filter((p) => p.id !== selectedId)].slice(0, 3);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[12px] rounded-outer border border-line bg-surface p-[16px] tablet:px-[20px]">
      <div>
        <h2 className="mb-[4px] font-display text-[12.5px]">POWER CHORDS</h2>
        <div className="font-mono text-[10px] text-text-muted tablet:text-[10.5px]">
          Best progressions · Key of {keyDisplayName(keyName)}
          <span className="hidden tablet:inline"> · E standard</span>
        </div>
      </div>
      <div className="flex flex-grow flex-col gap-[10px]">
        {shown.map((p) => (
          <ProgressionRow
            key={p.id}
            variant="panel"
            progression={p}
            chords={resolveProgression(keyName, p.id)}
            variantIndex={progressions.indexOf(p)}
            highlighted={p.id === selectedId}
            playing={p.id === playingId}
            onTogglePlay={() => onTogglePlay(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
