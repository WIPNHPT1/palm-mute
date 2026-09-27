"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayButton } from "@/components/PlayButton";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TabBlock } from "@/components/TabBlock";
import { useGenerator } from "@/context/GeneratorContext";
import {
  type LeadPart,
  type LeadStyle,
  INTRO_STYLES,
  RULES,
  SOLO_STYLES,
  defaultLeadStyle,
  generateLead,
  leadCopyText,
  nextLeadSeed,
  styleLabel,
} from "@/lib/melody";
import { type NoteName, type Progression, keyDisplayName, resolveProgression } from "@/lib/musicTheory";
import { leadBars } from "@/lib/playback";

const PARTS: { id: LeadPart; label: string }[] = [
  { id: "intro", label: "Intro melody" },
  { id: "solo", label: "Lead solo" },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard permission (e.g. some browsers, iframes): fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "fixed left-[-9999px]";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Secondary pill button, 44px tall. */
const BUTTON =
  "flex min-h-[44px] items-center gap-[8px] rounded-mid border border-line bg-paper px-[12px] font-mono text-[12px] font-bold text-text-primary hover:border-text-faintest";

/**
 * Opens under a Chords page card: the progression's degrees, Listen, and a lead writer with two tabs
 * (Intro melody, Lead solo): style, length, Generate, Play with backing, Play lead only, Copy tab and
 * Use in my song (the key, the progression as the Chorus, and this melody or solo). Esc closes it.
 */
export function ProgressionPanel({
  id,
  progression,
  keyName,
  playing,
  onTogglePlay,
  onClose,
  className = "",
}: {
  id: string;
  progression: Progression;
  keyName: NoteName;
  playing: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  className?: string;
}) {
  const { state, playCustom, stopPlayback, sendToSong } = useGenerator();
  const [part, setPart] = useState<LeadPart>("intro");
  const [choices, setChoices] = useState(() => ({
    intro: { ...defaultLeadStyle("intro"), seed: 0 },
    solo: { ...defaultLeadStyle("solo"), seed: 0 },
  }));
  const [status, setStatus] = useState<"sent" | "copied" | "copy-failed" | null>(null);
  const chords = resolveProgression(keyName, progression.id);
  const key = keyDisplayName(keyName);
  const choice = choices[part];
  const inputs = useMemo(
    () => ({ key: keyName, progressionId: progression.id, part, style: choice.style, bars: choice.bars, seed: choice.seed }),
    [keyName, progression.id, part, choice.style, choice.bars, choice.seed],
  );
  const lead = useMemo(() => generateLead(inputs), [inputs]);

  const previewId = `lead-${id}`;
  const previewing = state.playing?.startsWith(`custom:${previewId}`) ? state.playing.slice(`custom:${previewId}-`.length) : null;
  // A new take, part, key or feel means the preview no longer matches: stop it, and clear old messages.
  useEffect(() => {
    setStatus(null);
  }, [inputs]);
  useEffect(() => {
    if (state.playing?.startsWith(`custom:${previewId}`)) stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, state.feel]);

  // Esc closes the panel wherever focus is (Safari doesn't focus buttons on click), except while the
  // site menu is open: that Esc belongs to the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.documentElement.classList.contains("overflow-hidden")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (patch: Partial<{ style: LeadStyle; bars: number; seed: number }>) => setChoices((c) => ({ ...c, [part]: { ...c[part], ...patch } }));
  const styles = (part === "intro" ? INTRO_STYLES : SOLO_STYLES).map((s) => ({ value: s, label: styleLabel(part, s).toUpperCase() }));
  const lengths = RULES.lengths[part].map((b) => ({ value: String(b), label: `${b} BARS` }));
  const kind = part === "intro" ? "intro melody" : "solo";

  return (
    <div
      id={id}
      role="region"
      aria-label={`${progression.id} in ${key}`}
      className={`col-span-full flex min-w-0 flex-col gap-[14px] rounded-outer border-[1.5px] border-accent bg-surface p-[16px] shadow-card-highlight tablet:p-[20px] ${className}`}
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <h2 className="font-display text-[14px] tablet:text-[16px]">
            {progression.id} <span className="text-text-muted">in {key}</span>
          </h2>
          <p className="mt-[4px] font-mono text-[12px] leading-[1.5] text-text-muted">
            {chords.map((c, i) => `${progression.degrees[i]} = ${c.name}`).join(" · ")}
          </p>
        </div>
        <div className="-mr-[10px] -mt-[10px] flex items-center gap-[6px]">
          <div className="flex items-center rounded-mid border border-line bg-paper pr-[12px]">
            <PlayButton playing={playing} onClick={onTogglePlay} label={progression.id} />
            <span className="font-mono text-[12px] text-text-muted" aria-hidden="true">
              Chords
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-mid text-text-muted hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" />
            </svg>
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="Lead part" className="flex gap-[4px] border-b border-line">
        {PARTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`${id}-tab-${p.id}`}
            aria-selected={part === p.id}
            aria-controls={`${id}-lead`}
            onClick={() => setPart(p.id)}
            className={`-mb-px min-h-[44px] border-b-2 px-[12px] font-mono text-[12px] font-bold uppercase tracking-[0.06em] ${
              part === p.id ? "border-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${id}-lead`} aria-labelledby={`${id}-tab-${part}`} className="flex min-w-0 flex-col gap-[12px]">
        <div className="flex flex-col gap-[10px] tablet:flex-row tablet:flex-wrap tablet:items-end">
          <div className="flex flex-col gap-[6px]">
            <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">Style</span>
            <SegmentedControl label="Style" options={styles} value={choice.style} onChange={(style) => update({ style, seed: 0 })} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">Length</span>
            <SegmentedControl label="Length" options={lengths} value={String(choice.bars)} onChange={(b) => update({ bars: Number(b), seed: 0 })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-[8px]">
          <button type="button" onClick={() => update({ seed: nextLeadSeed(inputs) })} className={BUTTON}>
            GENERATE
          </button>
          {(["backing", "lead"] as const).map((mode) => {
            const on = previewing === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={on}
                onClick={() => playCustom(`${previewId}-${mode}`, leadBars(lead, state.feel, mode === "backing"), true)}
                className={BUTTON}
              >
                {on ? <StopIcon size={11} className="text-accent" /> : <PlayIcon size={11} filled={false} />}
                {mode === "backing" ? "PLAY WITH BACKING" : "PLAY LEAD ONLY"}
              </button>
            );
          })}
          <button
            type="button"
            onClick={async () => setStatus((await copyText(leadCopyText(lead))) ? "copied" : "copy-failed")}
            className={BUTTON}
          >
            COPY TAB
          </button>
          <button
            type="button"
            onClick={() => {
              sendToSong(keyName, progression.id, { part, style: choice.style, bars: choice.bars, seed: choice.seed });
              setStatus("sent");
            }}
            className="min-h-[44px] rounded-outer bg-accent px-[18px] font-display text-[12.5px] text-text-on-accent shadow-button"
          >
            USE IN MY SONG
          </button>
        </div>

        <TabBlock groups={lead.tab} spoken={lead.spoken} />

        <p role="status" className="min-h-[20px] font-mono text-[12px] text-text-muted">
          {status === "sent" && (
            <>
              Sent: key of {key}, {progression.id} as the Chorus, and this {styleLabel(part, choice.style)} {kind} as the {part === "intro" ? "Intro" : "Solo"}.{" "}
              <Link href="/generator/" className="inline-flex min-h-[44px] items-center text-accent underline underline-offset-4">
                Open the Generator
              </Link>
            </>
          )}
          {status === "copied" && "Tab copied."}
          {status === "copy-failed" && "Couldn't reach the clipboard. Try again, or copy the tab from the Generator."}
        </p>
      </div>
    </div>
  );
}
