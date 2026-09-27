import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { GeneratorProvider } from "@/context/GeneratorContext";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo-black" });
const spaceGrotesk = Space_Grotesk({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-space-grotesk" });
// No size-adjusted fallback: the strum glyphs (▼▲) aren't in Space Mono and would otherwise render oversized.
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "Palm/Mute · Pop-punk song generator",
  description: "Original pop-punk song structures and power-chord progressions in E standard, in any key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT may add the `dark` class before React hydrates.
    <html lang="en" className={`${archivoBlack.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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
