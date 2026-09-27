import type { Metadata } from "next";
import Link from "next/link";
import { BoltIcon } from "@/components/icons/BoltIcon";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { MobileNavRow } from "@/components/Nav";
import { SongTitleCard } from "@/components/SongTitleCard";

export const metadata: Metadata = { title: "About — Palm/Mute" };

const STEPS = [
  {
    title: "Study the formula",
    body: "We break down the chord degrees, rhythm templates and section lengths behind pop-punk's biggest hits — never the tabs themselves, only the underlying pattern.",
  },
  {
    title: "Generate your song",
    body: "Pick a key and a feel. Palm/Mute writes an intro, verse, chorus, solo and breakdown in E standard — a complete song structure, ready to play.",
  },
  {
    title: "Check, then play",
    body: "Every output runs through an originality check before it reaches you, comparing it against known riffs so nothing you get is a reproduction.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-[16px] px-[20px] pb-[30px] pt-[22px] tablet:gap-[20px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[32px] desktop:gap-[22px] desktop:flex-1 desktop:px-[56px] desktop:pb-[26px] desktop:pt-[40px]">
      <MobileNavRow />

      <div className="max-w-[760px]">
        <div className="mb-[7px] font-mono text-[10.5px] tracking-[0.13em] text-accent tablet:mb-[8px] tablet:text-[11px] tablet:tracking-[0.14em]">ABOUT PALM/MUTE</div>
        <h1 className="mb-[10px] font-display text-[21px] leading-[1.22] tracking-[-0.01em] tablet:mb-[12px] tablet:text-[28px] tablet:leading-[1.18] desktop:text-[34px] desktop:leading-[1.15]">
          SONGWRITING FORMULAS FROM THE BANDS THAT BUILT POP-PUNK.
        </h1>
        <p className="text-[12.5px] leading-[1.6] text-text-secondary tablet:text-[14px]">
          Palm/Mute studies the chord progressions, palm-muted rhythms and song structures that made pop-punk hits — then generates a brand-new song in your key, built on the same formula. Every riff is original. Nothing is copied.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[10px] tablet:gap-[12px] desktop:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className={`flex flex-col gap-[6px] rounded-outer border border-line border-t-2 bg-surface px-[16px] py-[14px] shadow-card tablet:gap-[8px] tablet:px-[20px] tablet:py-[16px] ${
              i === 0 ? "border-t-accent" : "border-t-ink-mid"
            }`}
          >
            <div className="flex items-baseline gap-[7px]">
              <div className={`font-mono text-[16px] font-bold ${i === 0 ? "text-accent" : "text-text-disabled"}`}>{String(i + 1).padStart(2, "0")}</div>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">{s.title}</h2>
            </div>
            <p className="text-[12px] leading-[1.55] text-text-secondary tablet:text-[12.5px]">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[8px] rounded-outer bg-ink px-[18px] py-[16px] text-text-on-dark tablet:flex-row tablet:items-center tablet:gap-[20px] tablet:px-[24px] tablet:py-[18px]">
        <div className="flex items-center gap-[8px] tablet:contents">
          <span className="block h-[8px] w-[8px] shrink-0 rounded-full bg-success" />
          <span className="text-[12px] font-bold tablet:hidden">Our originality promise</span>
        </div>
        <p className="text-[12.5px] leading-[1.6] text-text-on-dark-muted tablet:text-[13px]">
          <span className="hidden font-bold text-text-on-dark tablet:inline">Our originality promise — </span>
          Palm/Mute never stores or reproduces an artist&apos;s tab. We generate from chord-degree and rhythm patterns only, and every result is checked against known songs before it&apos;s shown to you.
        </p>
      </div>

      <div className="flex flex-col gap-[10px] tablet:flex-row tablet:gap-[12px] desktop:flex-grow">
        <div className="flex flex-1 flex-col justify-center gap-[8px] rounded-outer border border-line bg-surface px-[16px] py-[14px] shadow-card tablet:gap-[10px] tablet:px-[20px] tablet:py-[16px]">
          <div className="flex items-center gap-[8px]">
            <BoltIcon className="text-accent" />
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">Did you know</div>
          </div>
          <div className="font-display text-[16px] leading-[1.3] tablet:text-[18px]">A power chord is only two notes.</div>
          <p className="text-[12px] leading-[1.55] text-text-secondary tablet:text-[12.5px]">
            Root and fifth, no third. Drop the note that decides &ldquo;happy&rdquo; or &ldquo;sad&rdquo; and you&apos;re left with pure attitude — which is exactly why it&apos;s the only chord shape pop-punk ever needed.
          </p>
        </div>
        <SongTitleCard />
      </div>

      <div className="flex flex-col items-stretch gap-[12px] tablet:flex-row tablet:items-center">
        <Link
          href="/"
          className="flex items-center justify-center gap-[9px] rounded-mid bg-accent px-[24px] py-[14px] font-display text-[12.5px] text-text-on-accent shadow-button tablet:py-[12px]"
        >
          <PlayIcon size={11} className="text-text-on-accent" />
          START WRITING
        </Link>
        <Link href="/chords/" className="px-[16px] pt-[4px] text-center font-mono text-[12px] text-text-muted hover:text-text-primary tablet:py-[12px]">
          Browse the chord library →
        </Link>
      </div>
    </div>
  );
}
