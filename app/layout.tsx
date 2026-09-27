import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { GeneratorProvider } from "@/context/GeneratorContext";
import { SITE_URL, pageMetadata } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo-black" });
const spaceGrotesk = Space_Grotesk({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-space-grotesk" });
// No size-adjusted fallback: the strum glyphs (▼▲) aren't in Space Mono and would otherwise render oversized.
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono", adjustFontFallback: false });

const DESCRIPTION =
  "Write a pop-punk song in any key: power-chord progressions, real bar-by-bar tabs, palm-muted verses, big choruses, intro melodies and guitar solos in E standard. Free, in your browser.";

// Icons and share images come from files in app/ (icon.svg, favicon.ico, apple-icon.png,
// opengraph-image.png, twitter-image.png) and app/manifest.ts; `npm run build:brand` regenerates them.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Palm/Mute · Pop-punk song generator", template: "%s · Palm/Mute" },
  description: DESCRIPTION,
  applicationName: "Palm/Mute",
  keywords: ["pop-punk", "song generator", "power chords", "guitar tabs", "chord progressions", "songwriting", "E standard", "guitar solo generator", "punk rock"],
  category: "music",
  ...pageMetadata({ shareTitle: "Palm/Mute · Pop-punk song generator", description: DESCRIPTION, path: "/" }),
  formatDetection: { telephone: false },
};

// The top bar is ink in both themes, so the browser chrome matches it.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#171310" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0908" },
  ],
  colorScheme: "light dark",
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Palm/Mute",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "MusicApplication",
  operatingSystem: "Any (web browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT may add the `dark` class before React hydrates.
    <html lang="en" className={`${archivoBlack.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <GeneratorProvider>
          <Nav />
          {/* Full width: the home page runs edge to edge; Generator and Chords cap themselves at 1440px. */}
          <main className="flex w-full flex-1 flex-col">{children}</main>
          <Footer />
        </GeneratorProvider>
      </body>
    </html>
  );
}
