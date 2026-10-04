/** The tick or cross that draws itself at the end of a text field (the field's `sig-field` wrapper shows it by data-state). */
export function FieldStatus({ state }: { state: "ok" | "bad" | "" }) {
  return (
    <svg className="sig-field-st" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={state === "bad" ? "M6 6l12 12M18 6L6 18" : "M5 12.5l4.5 4.5L19 7.5"} />
    </svg>
  );
}
