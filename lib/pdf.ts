// Draws the songbook (lib/songbook.ts) as a PDF with jsPDF, the brand fonts embedded (Archivo Black and Space
// Mono, OFL, in public/fonts). jsPDF is loaded only when a PDF is made, so it never slows the page down.
import type { jsPDF as JsPDF } from "jspdf";
import { type Font, type Measure, type Songbook, type SongbookInput, layoutSongbook } from "@/lib/songbook";

/** The font files, as base64 (the browser fetches them; verify reads them from disk). */
export type FontFiles = Record<"mono" | "monoBold" | "display", string>;
export const FONT_FILES = { mono: "SpaceMono-Regular.ttf", monoBold: "SpaceMono-Bold.ttf", display: "ArchivoBlack-Regular.ttf" } as const;

const FAMILY: Record<Font, [string, string]> = { mono: ["SpaceMono", "normal"], monoBold: ["SpaceMono", "bold"], display: ["ArchivoBlack", "normal"] };

function registerFonts(doc: JsPDF, fonts: FontFiles) {
  for (const key of Object.keys(FONT_FILES) as (keyof typeof FONT_FILES)[]) {
    doc.addFileToVFS(FONT_FILES[key], fonts[key]);
    doc.addFont(FONT_FILES[key], FAMILY[key][0], FAMILY[key][1]);
  }
}

function measurer(doc: JsPDF): Measure {
  return (s, font, size) => {
    doc.setFont(...FAMILY[font]);
    doc.setFontSize(size);
    return doc.getTextWidth(s);
  };
}

/**
 * Lays out and draws the songbook: the PDF's bytes, and the layout it drew (for checks). `only` draws just
 * those pages (0-based), for previews.
 */
export function renderSongbook(JsPDFClass: typeof JsPDF, fonts: FontFiles, input: SongbookInput, only?: number[]): { bytes: ArrayBuffer; book: Songbook } {
  // jsPDF's named sizes, so the page boxes are exact (A4 595.28 × 841.89 pt, Letter 612 × 792 pt).
  const doc = new JsPDFClass({ unit: "mm", format: input.size, orientation: "portrait", compress: true });
  registerFonts(doc, fonts);
  const book = layoutSongbook(input, measurer(doc));
  doc.setProperties({ title: `${input.title} · Palm/Mute songbook`, subject: "Songbook", creator: "Palm/Mute", keywords: "pop-punk, power chords, tab" });
  const pages = only ? book.pages.filter((_, i) => only.includes(i)) : book.pages;
  pages.forEach((page, i) => {
    if (i > 0) doc.addPage(input.size, "portrait");
    for (const op of page.ops) {
      switch (op.kind) {
        case "rect":
          if (op.fill) doc.setFillColor(...op.fill);
          if (op.stroke) doc.setDrawColor(...op.stroke);
          doc.setLineWidth(op.lw ?? 0.2);
          if (op.r) doc.roundedRect(op.x, op.y, op.w, op.h, op.r, op.r, op.fill && op.stroke ? "FD" : op.fill ? "F" : "S");
          else doc.rect(op.x, op.y, op.w, op.h, op.fill && op.stroke ? "FD" : op.fill ? "F" : "S");
          break;
        case "line":
          doc.setDrawColor(...op.color);
          doc.setLineWidth(op.lw);
          doc.line(op.x1, op.y1, op.x2, op.y2);
          break;
        case "circle":
          if (op.fill) doc.setFillColor(...op.fill);
          if (op.stroke) doc.setDrawColor(...op.stroke);
          doc.setLineWidth(op.lw ?? 0.2);
          doc.circle(op.x, op.y, op.r, op.fill ? "F" : "S");
          break;
        case "poly": {
          doc.setFillColor(...op.fill);
          const [first, ...rest] = op.points;
          const segments = rest.map((p, k) => [p[0] - (k ? rest[k - 1][0] : first[0]), p[1] - (k ? rest[k - 1][1] : first[1])]);
          doc.lines(segments, first[0], first[1], [1, 1], "F", true);
          break;
        }
        case "text":
          doc.setFont(...FAMILY[op.font]);
          doc.setFontSize(op.size);
          doc.setTextColor(...op.color);
          doc.text(op.text, op.x, op.y, { align: op.align ?? "left", baseline: "alphabetic" });
          break;
      }
    }
  });
  return { bytes: doc.output("arraybuffer"), book };
}

/** In the browser: fetch the fonts, load jsPDF, draw. */
export async function songbookPdf(input: SongbookInput): Promise<Blob> {
  const [{ jsPDF }, fonts] = await Promise.all([import("jspdf"), loadFonts()]);
  return new Blob([renderSongbook(jsPDF, fonts, input).bytes], { type: "application/pdf" });
}

let fontCache: Promise<FontFiles> | null = null;
function loadFonts(): Promise<FontFiles> {
  fontCache ??= (async () => {
    const out = {} as FontFiles;
    for (const key of Object.keys(FONT_FILES) as (keyof typeof FONT_FILES)[]) {
      const buf = await (await fetch(`/fonts/${FONT_FILES[key]}`)).arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out[key] = btoa(bin);
    }
    return out;
  })();
  return fontCache;
}
