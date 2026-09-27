import { RegenerateIcon } from "./RegenerateIcon";

/** The song-title shuffle uses the same circular-arrows glyph as regenerate (component-spec §5). */
export function ShuffleIcon(props: { size?: number; className?: string }) {
  return <RegenerateIcon size={14} {...props} />;
}
