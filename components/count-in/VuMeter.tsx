"use client";

import { useEffect, useState } from "react";
import { onScrollFrame } from "@/components/count-in/scroll";

const SEGMENTS = 24;

/** Level meter showing how far down the page you are: green, then brass, then red at the end. */
export function VuMeter() {
  const [lit, setLit] = useState(0);
  useEffect(
    () => onScrollFrame(() => setLit(Math.round((scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * SEGMENTS))),
    [],
  );
  return (
    <div className="ci-vu" aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <i key={i} className={`${i >= SEGMENTS * 0.85 ? "peak" : i >= SEGMENTS * 0.6 ? "hot" : ""} ${i < lit ? "on" : ""}`} />
      ))}
    </div>
  );
}
