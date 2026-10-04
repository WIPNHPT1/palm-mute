/**
 * The design unit in CSS pixels: 1, or 0.9 from a 1440px window (--u in app/globals.css, DECISIONS.md "Design
 * scale"). CSS sizes use it automatically (scripts/postcss-design-unit.js); code that draws or caps sizes in
 * pixels itself multiplies by this.
 */
export function designUnit(): number {
  if (typeof window === "undefined") return 1;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")) || 1;
}
