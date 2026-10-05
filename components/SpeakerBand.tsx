"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Speaker } from "@/components/Speaker";

/**
 * The home page's background on the Song Generator and the Chord Lab (owner's call): a speaker cone on cloth across
 * the top of the page, pumping on the beat of whatever is playing, that fades into the scope further down (the scope
 * fades in under it: StageBackground's `under`). Placed on the page itself, so it scrolls with it, behind the page's
 * shell; tablet and up, like the scope.
 */
export function SpeakerBand() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!host) return null;
  return createPortal(
    <div className="speaker-band" data-speaker-band aria-hidden="true">
      <Speaker kind="band" engine />
    </div>,
    host,
  );
}
