"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { REPO_URL } from "@/components/Footer";
import { Wordmark } from "@/components/Wordmark";
import { applyTheme, currentTheme } from "@/lib/theme";

const LINKS = [
  { href: "/", label: "Count In" },
  { href: "/generator/", label: "Generator" },
  { href: "/chords/", label: "Chord Lab" },
];

function isActive(pathname: string, href: string) {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);
  return norm(pathname) === norm(href);
}

function DarkToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={onToggle}
      className="flex min-h-[44px] items-center gap-[8px] font-mono text-[12px] tracking-[0.06em] text-text-on-dark-faint hover:text-text-on-dark"
    >
      <span className={`relative block h-[16px] w-[30px] rounded-[8px] transition-colors ${dark ? "bg-accent" : "bg-ink-soft"}`}>
        <span
          className={`absolute top-[2px] block h-[12px] w-[12px] rounded-full bg-text-on-dark transition-[left] ${dark ? "left-[16px]" : "left-[2px]"}`}
        />
      </span>
      DARK
    </button>
  );
}

/**
 * Top bar: coin-flip wordmark + Shutter hamburger at every size (owner decisions, see DECISIONS.md).
 * The menu fills the screen under the bar: one full-width band per page, wiping in from the left,
 * plus a bottom strip with the dark toggle and the GitHub link. Styles live in globals.css.
 * The bar is sticky so the close button stays reachable when the menu is opened mid-page.
 */
export function Nav() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  // Starts false to match the server render; synced from the class THEME_SCRIPT set before paint.
  const [dark, setDark] = useState(false);

  useEffect(() => setDark(currentTheme() === "dark"), []);

  const toggleDark = () => {
    const next = !dark;
    applyTheme(next ? "dark" : "light");
    setDark(next);
  };

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    // The page behind a full-screen menu shouldn't scroll.
    document.documentElement.classList.toggle("overflow-hidden", menuOpen);
    if (!menuOpen) return;
    // Focus the menu itself, not its first link, so no band lights up until you hover or Tab to it.
    menu.current?.focus({ preventScroll: true });
    // Esc closes the menu and returns focus to the hamburger.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("overflow-hidden");
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sig-topbar sticky top-0 z-50 bg-ink text-text-on-dark">
        <div className="mx-auto flex h-[64px] max-w-[var(--page-max)] items-center justify-between px-[20px] tablet:h-[76px] tablet:px-[32px] desktop:px-[56px]">
          <Link href="/" className="flex min-h-[44px] items-center font-display text-[16px] tracking-[-0.01em] tablet:text-[17px]">
            <Wordmark />
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="relative -mr-[12px] h-[44px] w-[44px] text-text-on-dark"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="string-icon" data-open={menuOpen} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>
      <nav id="site-menu" ref={menu} tabIndex={-1} aria-label="Main" className="shutter-menu" data-open={menuOpen}>
        {LINKS.map((l, i) => {
          const current = isActive(pathname, l.href);
          return (
            <div key={l.href} className="shutter-band is-link">
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                // Also close when picking the page you're already on (pathname doesn't change then).
                onClick={() => setMenuOpen(false)}
                className="shutter-content mx-auto flex w-full max-w-[var(--page-max)] items-center gap-[14px] px-[20px] tablet:gap-[22px] tablet:px-[32px] desktop:px-[56px]"
              >
                <span className="shutter-index w-[24px] shrink-0 font-mono text-[12px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="shutter-label font-display text-[clamp(34px,7vw,96px)] uppercase leading-none tracking-[-0.01em]" data-current={current}>
                  {l.label}
                </span>
                {/* Drawn arrow: "→" isn't in the site's font subset and falls back to a thin glyph. */}
                <svg
                  className="shutter-arrow ml-auto h-auto w-[clamp(28px,3.4vw,44px)] shrink-0"
                  viewBox="0 0 40 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={4}
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M0 12h34M23 2l12 10-12 10" />
                </svg>
              </Link>
            </div>
          );
        })}
        <div className="shutter-band is-strip">
          <div className="shutter-content mx-auto flex w-full max-w-[var(--page-max)] items-center justify-between px-[20px] tablet:px-[32px] desktop:px-[56px]">
            <DarkToggle dark={dark} onToggle={toggleDark} />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center font-mono text-[12px] tracking-[0.06em] text-text-on-dark-faint hover:text-text-on-dark"
            >
              GITHUB ↗
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
