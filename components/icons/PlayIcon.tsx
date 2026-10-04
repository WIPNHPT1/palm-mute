type Props = { size?: number; filled?: boolean; className?: string };

/** Filled = currently playing/selected; outlined = alternate. Color comes from `currentColor`. */
export function PlayIcon({ size = 11, filled = true, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      style={{ width: `calc(${size} * var(--u))`, height: `calc(${size} * var(--u))` }}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
