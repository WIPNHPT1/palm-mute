/**
 * PALM/MUTE wordmark with a lightning bolt in place of the "/". The bolt flips like a tossed coin
 * every few seconds (`.wordmark-bolt` in globals.css; still for reduced-motion users).
 * Screen readers get the plain name.
 */
export function Wordmark() {
  return (
    <span role="img" aria-label="Palm/Mute" className="inline-flex items-center whitespace-nowrap">
      PALM
      <span aria-hidden="true" className="wordmark-bolt text-accent">
        <svg viewBox="0 0 12 20">
          <path d="M9.2 0 .4 12h5.4L3.4 20l8.4-12.4H6.4L9.2 0Z" fill="currentColor" />
        </svg>
      </span>
      MUTE
    </span>
  );
}
