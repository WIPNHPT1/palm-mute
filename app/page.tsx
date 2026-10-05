import type { Metadata } from "next";
import { HomeBento } from "@/components/home/HomeBento";
import { pageMetadata } from "@/lib/site";
import "./home.css";

const DESCRIPTION =
  "Palm/Mute studies the chord progressions, palm-muted rhythms and song structures behind pop-punk hits, then writes you a brand-new song in your key.";

// The root layout's title template doesn't reach a page in its own segment, so this one is absolute.
export const metadata: Metadata = pageMetadata({ title: { absolute: "Count In · Palm/Mute" }, shareTitle: "Palm/Mute · Pop-punk song generator", description: DESCRIPTION, path: "/" });

export default function Home() {
  return <HomeBento />;
}
