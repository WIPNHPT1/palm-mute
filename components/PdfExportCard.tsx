"use client";

import { useState } from "react";
import { download } from "@/components/MidiExportCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import { fileName } from "@/lib/arrange";
import type { PaperSize, SongbookInput } from "@/lib/songbook";

/**
 * PDF songbook (docs/song-builder-prd.md B8, §8): a branded cover, a chart (chord boxes, the form with bar
 * numbers and times) and every section's full tab as a songbook, on A4 or US Letter. jsPDF and the fonts load
 * only when you press the button.
 */
export function PdfExportCard({ input }: { input: Omit<SongbookInput, "size" | "date"> }) {
  const [size, setSize] = useState<PaperSize>("a4");
  const [status, setStatus] = useState<{ busy: boolean; text: string }>({ busy: false, text: "" });
  const save = async () => {
    setStatus({ busy: true, text: "Making the songbook…" });
    try {
      const { songbookPdf } = await import("@/lib/pdf");
      const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const blob = await songbookPdf({ ...input, size, date });
      const name = fileName(input.title, "pdf");
      download(blob, name, "application/pdf");
      setStatus({ busy: false, text: `Saved ${name}.` });
    } catch {
      setStatus({ busy: false, text: "Couldn't make the PDF. Check your connection (the fonts load on demand) and try again." });
    }
  };
  return (
    <div data-export="pdf" className="flex min-w-0 flex-col gap-[12px] rounded-outer border border-line bg-surface px-[16px] py-[14px] shadow-card tablet:px-[18px] tablet:py-[16px]">
      <h3 className="m-0 font-display text-[17px] leading-[1.3]">PDF songbook</h3>
      <p className="m-0 max-w-[62ch] font-mono text-[12px] leading-[1.6] text-text-muted">
        A cover with the song&apos;s facts and running order, a chart of every chord shape and the form with times, then every section&apos;s full tab with bar
        numbers, rhythm and repeats: the tabs on this page, on paper.
      </p>
      {/* The pages, in miniature (decorative). */}
      <div className="flex gap-[10px] overflow-hidden py-[2px]" aria-hidden="true">
        <div className="flex aspect-[210/297] w-[76px] shrink-0 flex-col gap-[4px] rounded-[3px] bg-ink p-[7px]">
          {/* The wordmark as the printed cover has it: the site's bolt (components/Wordmark.tsx), still. */}
          <span className="inline-flex items-center whitespace-nowrap font-display text-[8px] leading-none text-text-on-dark">
            PALM
            <svg viewBox="0 0 12 20" className="mx-[0.04em] h-[0.9em] w-[0.6em] text-accent-on-ink" aria-hidden="true">
              <path d="M9.2 0 .4 12h5.4L3.4 20l8.4-12.4H6.4L9.2 0Z" fill="currentColor" />
            </svg>
            MUTE
          </span>
          <span className="mt-[10px] h-[10px] rounded-[2px] bg-board-cell" />
          <span className="h-[3px] w-[60%] rounded-[1px] bg-ink-mid" />
          <span className="mt-auto h-[6px] rounded-[1px] bg-ink-soft" />
        </div>
        {["Chart", "Intro · Verse", "Chorus", "Solo"].map((p) => (
          <div key={p} className="flex aspect-[210/297] w-[76px] shrink-0 flex-col gap-[4px] rounded-[3px] border border-line-strong bg-[#fff] p-[7px]">
            <span className="h-[2px] rounded-[1px] bg-accent" />
            <span className="flex-1 bg-[repeating-linear-gradient(#fff_0_3px,#dcd3be_3px_4px)] bg-[length:100%_22px]" />
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-[10px]">
        <SegmentedControl
          label="Paper size"
          options={[
            { value: "a4", label: "A4" },
            { value: "letter", label: "LETTER" },
          ]}
          value={size}
          onChange={setSize}
          stretch
          className="w-[140px]"
        />
        <button
          type="button"
          onClick={save}
          disabled={status.busy}
          className="ml-auto flex min-h-[48px] items-center justify-center gap-[9px] rounded-outer bg-accent px-[20px] py-[12px] font-display text-[12.5px] text-text-on-accent shadow-button transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
          </svg>
          DOWNLOAD PDF
        </button>
      </div>
      <p className="m-0 min-h-[1.6em] font-mono text-[12px] text-text-faint" role="status">
        {status.text}
      </p>
    </div>
  );
}
