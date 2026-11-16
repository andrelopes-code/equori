import type { ReactElement } from "react";

const stripeCount = 7;
const stripeHeight = 18 / 13;
const starRows = 4;
const starColumns = 5;
const euStarCount = 12;

// The artwork of the flags the application serves, on a 24 by 18 grid. A region without a case has
// none and takes a plate (docs/contributing/regions.md, "Flag").
export function flagArt(region: string): ReactElement | null {
  switch (region) {
    case "BR":
      return brazil;
    case "US":
      return unitedStates;
    case "EU":
      return euroArea;
    case "global":
      return globe;
    default:
      return null;
  }
}

const brazil = (
  <svg viewBox="0 0 24 18">
    <rect width="24" height="18" fill="#009c3b" />
    <path d="M12 2.2 21.6 9 12 15.8 2.4 9z" fill="#ffdf00" />
    <circle cx="12" cy="9" r="4" fill="#002776" />
    <path
      d="M8.2 8.1c2.6-.9 5.5-.4 7.7 1.3"
      stroke="#fff"
      strokeWidth=".8"
      fill="none"
    />
  </svg>
);

const unitedStates = (
  <svg viewBox="0 0 24 18">
    <rect width="24" height="18" fill="#fff" />
    {Array.from({ length: stripeCount }, (_, i) => (
      <rect
        key={i}
        y={i * 2 * stripeHeight}
        width="24"
        height={stripeHeight}
        fill="#b22234"
      />
    ))}
    <rect width="10.4" height="9.7" fill="#3c3b6e" />
    {Array.from({ length: starRows * starColumns }, (_, i) => (
      <circle
        key={i}
        cx={1.2 + (i % starColumns) * 1.9}
        cy={1.2 + Math.floor(i / starColumns) * 1.9}
        r=".36"
        fill="#fff"
      />
    ))}
  </svg>
);

const euroArea = (
  <svg viewBox="0 0 24 18">
    <rect width="24" height="18" fill="#039" />
    {Array.from({ length: euStarCount }, (_, i) => {
      const angle = (i / euStarCount) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={12 + Math.sin(angle) * 5.2}
          cy={9 - Math.cos(angle) * 5.2}
          r=".75"
          fill="#fc0"
        />
      );
    })}
  </svg>
);

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
