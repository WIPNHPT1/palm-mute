import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

const DESCRIPTION =
  "Pick a key and a feel and get a whole pop-punk song: intro, palm-muted verse, lifted chorus, guitar solo and half-time breakdown, as real power-chord tabs you can play along with.";

export const metadata: Metadata = pageMetadata({ title: "Generator", shareTitle: "Song generator · Palm/Mute", description: DESCRIPTION, path: "/generator/" });

export default function GeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
