"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { isActive } from "@/components/Nav";
import { Wordmark } from "@/components/Wordmark";
import { FEEL_IDS, getFeel, playbackBpm } from "@/lib/generator";
import { TUNINGS } from "@/lib/lab/chords";
import { getProgression } from "@/lib/musicTheory";

export const REPO_URL = "https://github.com/WIPNHPT1/palm-mute";

// The footer's pages, by their full names.
const PAGES = [
  { href: "/", label: "Home" },
  { href: "/generator/", label: "Song Generator" },
  { href: "/chords/", label: "Chord Lab" },
];

// The credits roll: the song every page opens on (the Generator's defaults) and the promise.
const FIRST_FEEL = FEEL_IDS[0];
const CREDITS: { role: string; name: string; red?: boolean; asWritten?: boolean }[] = [
  { role: "Written by", name: "You" },
  { role: "In the key of", name: "A" },
  { role: "Feel", name: `${getFeel(FIRST_FEEL).label} · ${playbackBpm(FIRST_FEEL)} BPM` },
  { role: "Chords", name: getProgression("I-V-vi-IV").degrees.join(" – "), asWritten: true }, // case matters: vi is minor
  { role: "Tuning", name: TUNINGS[0].label },
  { role: "Tabs stored", name: "None", red: true },
  { role: "Every riff", name: "Written fresh" },
  { role: "Parts", name: "Intro · Verse · Chorus · Solo · Breakdown" },
  { role: "No artists were copied in the making of this song", name: "✦", red: true },
];

/**
 * End credits (owner's pick, docs/mockups/footer-options.html option 1): every page ends like a film. The page fades
 * to black, the credits roll up (a seamless loop, so the window is never empty), then the wordmark with the pages and
 * GitHub. One cinema black in both themes. The roll only runs while the footer is on screen, and stands still (every
 * credit showing once) with reduced motion.
 */
export function Footer() {
  const pathname = usePathname() ?? "/";
  const roll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = roll.current!;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute("data-rolling", e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer className="credits">
      <span className="credits-fade" aria-hidden="true" />
      <div ref={roll} className="credits-roll">
        {/* the list twice, end to end, so the roll loops with no gap; the copy is for the eye only */}
        <div className="credits-reel">
          <dl className="credits-list"><CreditItems /></dl>
          <div className="credits-list credits-copy" aria-hidden="true"><CreditItems /></div>
        </div>
      </div>
      <div className="credits-end">
        <Link href="/" prefetch={false} className="credits-wm" aria-label="Palm/Mute, home">
          <Wordmark />
        </Link>
        <div className="credits-links">
          <nav aria-label="Footer">
            {PAGES.map((p) => (
              // no prefetch: the footer is at the very end of the page, and an aborted prefetch is logged as an error in WebKit
              <Link key={p.href} href={p.href} prefetch={false} aria-current={isActive(pathname, p.href) ? "page" : undefined}>
                {p.label}
              </Link>
            ))}
          </nav>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="credits-gh">
            <GitHubIcon size={18} gradient />
            GitHub
          </a>
        </div>
        <p className="credits-fine">Palm/Mute · pop-punk song generator</p>
      </div>
    </footer>
  );
}

function CreditItems() {
  return CREDITS.map((c) => (
    <div key={c.role} className={[c.red && "red", c.asWritten && "as-written"].filter(Boolean).join(" ") || undefined}>
      <dt>{c.role}</dt>
      <dd>{c.name}</dd>
    </div>
  ));
}
