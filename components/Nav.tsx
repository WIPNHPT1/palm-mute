"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HamburgerIcon } from "@/components/icons/HamburgerIcon";

const LINKS = [
  { href: "/", label: "Generator" },
  { href: "/chords/", label: "Chords" },
  { href: "/about/", label: "About" },
];

function isActive(pathname: string, href: string) {
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);
  return norm(pathname) === norm(href);
}

/** Dark mode is scoped out of v1 (open decision) — the toggle is shown but disabled. */
function DarkToggle() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Dark mode — coming soon"
      className="flex cursor-not-allowed items-center gap-[6px] font-mono text-[10.5px] text-text-muted"
    >
      <span className="relative block h-[16px] w-[30px] rounded-[8px] bg-ink-soft">
        <span className="absolute left-[2px] top-[2px] block h-[12px] w-[12px] rounded-full bg-paper" />
      </span>
      DARK
    </button>
  );
}

export function Nav() {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  const links = (className: string) =>
    LINKS.map((l) => (
      <Link
        key={l.href}
        href={l.href}
        aria-current={isActive(pathname, l.href) ? "page" : undefined}
        className={`${className} ${isActive(pathname, l.href) ? "text-accent" : "hover:text-text-on-dark"}`}
      >
        {l.label}
      </Link>
    ));

  return (
    <header className="bg-ink text-text-on-dark">
      <div className="mx-auto flex h-[64px] max-w-[1440px] items-center justify-between px-[20px] tablet:h-[76px] tablet:px-[32px] desktop:px-[56px]">
        <div className="flex items-center gap-[28px] desktop:gap-[40px]">
          <Link href="/" className="font-display text-[16px] tracking-[-0.01em] tablet:text-[17px]">
            PALM<span className="text-accent">/</span>MUTE
          </Link>
          <nav aria-label="Main" className="hidden gap-[20px] font-mono text-[11px] uppercase tracking-[0.05em] text-text-faint tablet:flex desktop:gap-[26px] desktop:text-[11.5px]">
            {links("")}
          </nav>
        </div>
        <div className="hidden tablet:block">
          <DarkToggle />
        </div>
        <button
          type="button"
          className="text-text-on-dark tablet:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <HamburgerIcon />
        </button>
      </div>
      {menuOpen && (
        <div id="mobile-menu" className="flex flex-col gap-[14px] border-t border-ink-soft px-[20px] py-[16px] tablet:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-[12px] font-mono text-[12px] uppercase tracking-[0.05em] text-text-faint">
            {links("py-[2px]")}
          </nav>
          <DarkToggle />
        </div>
      )}
    </header>
  );
}

/** Mobile-only inline link row under the header, as drawn in every mobile mockup. */
export function MobileNavRow() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Pages" className="flex gap-[14px] font-mono text-[10px] uppercase tracking-[0.05em] text-text-faint tablet:hidden">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(pathname, l.href) ? "text-accent" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
