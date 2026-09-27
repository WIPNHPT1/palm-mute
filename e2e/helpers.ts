import { type Page } from "@playwright/test";

/** What the page last asked the audio engine to play (lib/audio/engine.ts), or null when stopped. */
export type Playback = {
  bars: { feel: string; cells: ({ notes: number[]; cells: number; velocity: number; palmMuted: boolean } | null)[] }[];
  bpm: number;
  loop: boolean;
} | null;

export async function lastPlayback(page: Page): Promise<Playback> {
  return page.evaluate(() => (window as unknown as { __palmMuteLastPlayback?: Playback }).__palmMuteLastPlayback ?? null);
}

export const section = (page: Page, label: string) => page.locator(`section[aria-label="${label}"]`);
export const key = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name, exact: true });
export const feel = (page: Page, name: RegExp) => page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio", { name });
