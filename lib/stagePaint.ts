// The moving background behind the Song Generator and the Chord Lab (an oscilloscope), drawn on one canvas
// (components/StageBackground.tsx). Pure drawing: given a 2D context, its size in pixels, the time in seconds and
// whether music is playing, paint one frame. Colours are the theme's tokens, faint.

export type StageColors = { line: string; faint: string; accent: string; dark: boolean };

/** Reads the palette from the page's colour tokens (Tailwind stores them as "r g b" channels). */
export function readStageColors(): StageColors {
  const cs = getComputedStyle(document.documentElement);
  const ch = (n: string) => cs.getPropertyValue(`--color-${n}`).trim();
  return { line: ch("line-strong"), faint: ch("text-faintest"), accent: ch("accent"), dark: document.documentElement.classList.contains("dark") };
}
const rgba = (channels: string, a: number) => `rgb(${channels} / ${a})`;


/**
 * An oscilloscope: a faint scope graticule and three slow sine traces, the middle one in the accent; busier while
 * music plays. `s` scales line widths and the grid to the device pixel ratio.
 */
export function paintOscilloscope(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, playing: boolean, c: StageColors, s = 1) {
  const step = 96 * s;
  ctx.lineWidth = 1 * s;
  ctx.strokeStyle = rgba(c.line, c.dark ? 0.5 : 0.6);
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const amp = h * (0.05 + i * 0.03) * (playing ? 1.7 : 1);
    const k = ((1.4 + i * 0.8) * Math.PI * 2) / w;
    const ph = t * (0.35 + i * 0.22) * (playing ? 2.2 : 1);
    const y0 = h * (0.32 + 0.17 * i);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4 * s) {
      const y = y0 + amp * Math.sin(x * k + ph) * Math.sin((x / w) * Math.PI) * (1 + 0.25 * Math.sin(x * k * 3.1 - ph * 1.7));
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = (i === 1 ? 2 : 1.4) * s;
    ctx.strokeStyle = i === 1 ? rgba(c.accent, c.dark ? 0.32 : 0.22) : rgba(c.faint, c.dark ? 0.35 : 0.3);
    ctx.stroke();
  }
}
