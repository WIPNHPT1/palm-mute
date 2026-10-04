type Props = { size?: number; className?: string };

/** Shown in place of the play triangle while a progression is looping, so it reads as "click to stop". */
export function StopIcon({ size = 11, className }: Props) {
  return (
    <svg width={size} height={size} style={{ width: `calc(${size} * var(--u))`, height: `calc(${size} * var(--u))` }} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}
