// Originality check (data-model.md §6).
// v1 decision: always PASS — the badge is a design/marketing element only. The recommended
// v2 approach (compare generated degree sequences against a curated reference set of known
// progressions) plugs in here without touching callers.
import type { RenderedSection } from "@/lib/generator";

export type OriginalityStatus = "pass" | "flagged";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function checkOriginality(sections: RenderedSection[]): OriginalityStatus {
  return "pass";
}
