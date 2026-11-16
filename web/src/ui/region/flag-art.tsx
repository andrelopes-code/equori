import type { ReactElement } from "react";

// The symbol of the global region, on a 24 by 24 grid. Country flags come from flag-icons
// (flag-url.ts); the global region has none.
export function globeArt(): ReactElement {
  return globe;
}

const globe = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);
