// "Stuck on a song title?" titles (data/title-generator.json). Pure text, no music logic.
import titleJson from "@/data/title-generator.json";

export const TITLES: string[] = titleJson.titles;
export const MAX_TITLE_LENGTH: number = titleJson.maxLength;

export type TitleBag = {
  /** The title currently showing. */
  current(): string;
  /** Deals the next title: every title appears once before any repeats. */
  next(): string;
};

function shuffle(items: number[], rng: () => number): number[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A shuffle bag over TITLES, like dealing from a deck. It starts on titles[first] (so a pre-rendered page
 * and the browser agree on the first title), deals the rest in random order, then reshuffles, never
 * starting a new round with the title just shown.
 */
export function createTitleBag(rng: () => number = Math.random, first = 0): TitleBag {
  const all = TITLES.map((_, i) => i);
  let current = first;
  let deck = shuffle(all.filter((i) => i !== first), rng);
  return {
    current: () => TITLES[current],
    next() {
      if (deck.length === 0) {
        deck = shuffle(all, rng);
        // the deck deals from the end; keep the just-shown title off the top of the new round
        if (deck[deck.length - 1] === current) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
      }
      current = deck.pop()!;
      return TITLES[current];
    },
  };
}

/** One deck per visit: kept while you move between pages, fresh on a full reload. */
export const titleBag = createTitleBag();
