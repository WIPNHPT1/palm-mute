"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HamburgerIcon } from "@/components/icons/HamburgerIcon";
import { applyTheme, currentTheme } from "@/lib/theme";

const LINKS = [
  { href: "/", label: "Generator" },
  { href: "/chords/", label: "Chords" },
  { href: "/about/", label: "About" },
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
      className="flex items-center gap-[6px] self-start font-mono text-[10.5px] text-text-muted hover:text-text-on-dark-faint"
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
 * Top bar: logo + hamburger at every size (owner decision, see DECISIONS.md — the mockups' inline
 * desktop/tablet links were replaced). The menu drops down under the bar with the page links and
 * the dark-mode toggle, aligned to the page content's left edge.
 */
export function Nav() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Starts false to match the server render; synced from the class THEME_SCRIPT set before paint.
  const [dark, setDark] = useState(false);

  useEffect(() => setDark(currentTheme() === "dark"), []);

  const toggleDark = () => {
    const next = !dark;
    applyTheme(next ? "dark" : "light");
    setDark(next);
  };

  useEffect(() => setMenuOpen(false), [pathname]);

  // Esc closes the menu and returns focus to the hamburger.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="bg-ink text-text-on-dark">
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center justify-between px-[20px] tablet:h-[76px] tablet:px-[32px] desktop:px-[56px]">
        <Link href="/" className="font-display text-[16px] tracking-[-0.01em] tablet:text-[17px]">
          PALM<span className="text-accent">/</span>MUTE
        </Link>
        <button
          ref={menuButton}
          type="button"
          className="text-text-on-dark hover:text-accent"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <HamburgerIcon />
        </button>
      </div>
      {menuOpen && (
        <div id="site-menu" className="border-t border-ink-soft">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-[14px] px-[20px] py-[16px] tablet:px-[32px] desktop:px-[56px]">
            <nav aria-label="Main" className="flex flex-col items-start gap-[12px] font-mono text-[12px] uppercase tracking-[0.05em] text-text-faint">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(pathname, l.href) ? "page" : undefined}
                  // Also close when picking the page you're already on (pathname doesn't change then).
                  onClick={() => setMenuOpen(false)}
                  className={`py-[2px] ${isActive(pathname, l.href) ? "text-accent" : "hover:text-text-on-dark"}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <DarkToggle dark={dark} onToggle={toggleDark} />
          </div>
        </div>
      )}
    </header>
  );
}
