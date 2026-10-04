import type { KeyboardEvent } from "react";

// The standard radio-group keyboard pattern, shared by every `role="radiogroup"` on the site: the checked radio
// is the group's one Tab stop (the others are skipped), and the arrow keys move inside the group, selecting as they
// go (selection follows focus). Without it each button is its own Tab stop (the 12 keys alone took 12 presses).

const KEYS = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];

/** `onKeyDown` for the group element: arrows move to the next or previous radio (wrapping), Home and End to the ends. */
export function onRovingKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!KEYS.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
  const at = radios.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  const to = e.key === "Home" ? 0 : e.key === "End" ? radios.length - 1 : (at + step + radios.length) % radios.length;
  radios[to].focus();
  radios[to].click();
}

/** `tabIndex` for each radio: the checked one (or, if none is, the first) is reachable by Tab; the rest by arrows. */
export const rovingTabIndex = (checked: boolean, anyChecked: boolean, index: number): 0 | -1 => (checked || (!anyChecked && index === 0) ? 0 : -1);
