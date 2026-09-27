import type { OriginalityStatus } from "@/lib/originalityCheck";

export function OriginalityBadge({ status }: { status: OriginalityStatus }) {
  const pass = status === "pass";
  return (
    <div
      role="status"
      className="inline-flex items-center gap-[7px] self-start rounded-pill border border-line-strong py-[6px] pl-[9px] pr-[12px] font-mono text-[9.5px] text-text-muted tablet:gap-[8px] tablet:self-auto tablet:py-[7px] tablet:pl-[10px] tablet:pr-[14px] tablet:text-[10.5px]"
    >
      <span className={`block h-[6px] w-[6px] rounded-full ${pass ? "bg-success" : "bg-brass"}`} />
      ORIGINALITY CHECK · {pass ? "PASS" : "REFERENCE FORMULA"}
    </div>
  );
}
