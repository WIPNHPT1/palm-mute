import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

const DESCRIPTION =
  "The six chord progressions behind pop-punk, in all 12 keys, with power-chord shapes to play. Write an intro melody or a guitar solo over any of them and send it to your song.";

export const metadata: Metadata = pageMetadata({ title: "Chords", shareTitle: "Pop-punk chord progressions · Palm/Mute", description: DESCRIPTION, path: "/chords/" });

export default function ChordsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
