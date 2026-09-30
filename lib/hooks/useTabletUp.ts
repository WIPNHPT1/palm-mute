"use client";

import { useSyncExternalStore } from "react";

/** True from the tablet breakpoint up (tailwind.config.js). Static pages render the phone layout first. */
export function useTabletUp(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia("(min-width: 834px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => matchMedia("(min-width: 834px)").matches,
    () => false,
  );
}
