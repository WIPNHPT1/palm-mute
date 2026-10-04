"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isStagePath } from "@/lib/stage";

/**
 * Wraps the top bar, the page and the footer. On the Song Generator and the Chord Lab it turns on the big-screen
 * zoom (`.page-zoom` in app/globals.css, sized by --page-zoom from lib/stage.ts) and the brass spotlight over the page
 * title (`.sig-spotlight`); every other page stays as it is.
 */
export function ZoomShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  return (
    <div className={`relative z-[1] flex flex-1 flex-col ${isStagePath(path) ? "sig-spotlight" : ""}`} data-zoom={isStagePath(path) ? "on" : undefined}>
      {children}
    </div>
  );
}
