import type { Metadata, Viewport } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import { AudioNotice } from "@/components/AudioNotice";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { GeneratorProvider } from "@/context/GeneratorContext";
import { SITE_URL, pageMetadata } from "@/lib/site";
import { GUIDE_SCRIPT } from "@/lib/guide";
import { PageWipe } from "@/components/PageWipe";
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

// The top bar is ink in both themes, so the browser chrome matches it: the dark theme's ink, the default.
export const viewport: Viewport = {
  themeColor: "#0B0908",
  // Dark by default; a reader who picks light gets `color-scheme: light` from the :root stylesheet rules.
  colorScheme: "dark",
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
    // Rendered dark (the default), so there's never a light flash. suppressHydrationWarning: THEME_SCRIPT removes the
    // `dark` class before React hydrates for a reader who chose light.
    <html lang="en" className={`dark ${archivoBlack.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: GUIDE_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <GeneratorProvider>
          {/* Above the moving background (components/StageBackground.tsx, z-index 0). */}
          <div className="relative z-[1] flex flex-1 flex-col">
            <Nav />
            <AudioNotice />
            {/* Full width: the home page runs edge to edge; Generator and Chords cap themselves at --page-max. */}
            <main className="flex w-full flex-1 flex-col">{children}</main>
            <Footer />
          </div>
          <PageWipe />
        </GeneratorProvider>
      </body>
    </html>
  );
}
