"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const BANDS = 5;
/** How long the bands take to close over the old page, and to open off the new one. */
const COVER_MS = 520;
const REVEAL_MS = 620;
/** If the next page is slow to arrive, open the shutter anyway. */
const GIVE_UP_MS = 4000;

const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

/**
 * Moving between pages wipes across in the menu's ink and red bands (owner's pick, docs/mockups/stage-options.html):
 * clicking a link to another page of the site closes the shutter over this one, the next page loads behind it, and
 * the shutter opens off it. Links within a page (#tool), other sites, new tabs and modified clicks behave as
 * normal, and anyone with reduced motion gets plain page changes. The bands never take a click.
 */
export function PageWipe() {
  const router = useRouter();
  const path = usePathname() ?? "/";
  const [phase, setPhase] = useState<"idle" | "cover" | "reveal">("idle");
  const first = useRef(true);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  // Close the shutter, then go.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || norm(url.pathname) === norm(location.pathname)) return;
      e.preventDefault();
      setPhase("cover");
      later(() => router.push(url.pathname + url.search + url.hash), COVER_MS);
      later(() => setPhase((p) => (p === "cover" ? "reveal" : p)), COVER_MS + GIVE_UP_MS);
    };
    // Capture, so this runs before the link's own navigation (which then sees the click is handled).
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // The new page is here: open the shutter.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPhase((p) => (p === "cover" ? "reveal" : p));
  }, [path]);
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = window.setTimeout(() => setPhase("idle"), REVEAL_MS + BANDS * 60);
    return () => window.clearTimeout(t);
  }, [phase]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return (
    <div className="page-wipe" data-phase={phase} aria-hidden="true">
      {Array.from({ length: BANDS }, (_, i) => (
        <i key={i} style={{ "--i": i } as React.CSSProperties} />
      ))}
    </div>
  );
}
