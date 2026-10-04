import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

const DESCRIPTION =
  "A guitarist's chord toolbox: every chord a pop-punk player needs in every position, name any shape you tap, build a loop, find its key and move it to a capo or a drop tuning.";

export const metadata: Metadata = pageMetadata({ title: "Chord Lab", shareTitle: "Chord Lab: look up, name and move chords · Palm/Mute", description: DESCRIPTION, path: "/chords/" });

export default function ChordsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
