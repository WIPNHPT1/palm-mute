import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { GeneratorProvider } from "@/context/GeneratorContext";
import "./globals.css";

const archivoBlack = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo-black" });
const spaceGrotesk = Space_Grotesk({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-space-grotesk" });
// No size-adjusted fallback: the strum glyphs (▼▲) aren't in Space Mono and would otherwise render oversized.
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "Palm/Mute — Pop-punk song generator",
  description: "Original pop-punk song structures and power-chord progressions in E standard, in any key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen">
        <GeneratorProvider>
          <Nav />
          <main className="mx-auto w-full max-w-[1440px]">{children}</main>
        </GeneratorProvider>
      </body>
    </html>
  );
}
