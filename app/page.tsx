import type { Metadata } from "next";
import { CountIn } from "@/components/count-in/CountIn";
import "./count-in.css";

export const metadata: Metadata = {
  title: "Count In · Palm/Mute",
  description: "Palm/Mute studies the chord progressions, palm-muted rhythms and song structures behind pop-punk hits, then writes you a brand-new song in your key.",
};

export default function Home() {
  return <CountIn />;
}
