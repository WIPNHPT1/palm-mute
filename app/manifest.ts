import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Home-screen install (Android/Chrome). Icons are rendered by `npm run build:brand`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Palm/Mute · Pop-punk song generator",
    short_name: "Palm/Mute",
    description: "Pop-punk songs, power-chord tabs, intro melodies and solos, in any key.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F1E4",
    theme_color: "#171310",
    categories: ["music", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
