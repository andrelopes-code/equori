import { useId } from "react";

import type { AccountCardKind } from "@/features/accounts/account-card-kind";
import styles from "@/features/accounts/account-card.module.css";

// The art is drawn in the card's own units (340 by 214, the ID-1 ratio) around a centre just past
// the right edge, half way down. An elliptical mask around that centre fades it out before the
// header, the amount and the meter, so no line ends on a straight edge and none crosses text.
const width = 340;
const height = 214;
const cx = 352;
const cy = 107;

const fixed = (n: number) => n.toFixed(1);

function closedPath(points: [number, number][]): string {
  return `${points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${fixed(x)} ${fixed(y)}`)
    .join("")}Z`;
}

function ring(radius: (angle: number) => number, steps = 144): string {
  return closedPath(
    Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * 2 * Math.PI;
      const r = radius(a);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
  );
}

// Credit: a guilloché rosette, the pattern of banknotes and printed cards: ellipses turned about
// a centre past the edge, so the card shows the outer petals and their lattice, not the dense core.
function rosette(): string[] {
  const count = 16;
  const rx = 150;
  const ry = 50;
  const centre = cx + 40;
  return Array.from({ length: count }, (_, i) => {
    const turn = (i * Math.PI) / count;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    return closedPath(
      Array.from({ length: 120 }, (_, j) => {
        const t = (j / 120) * 2 * Math.PI;
        const x = rx * Math.cos(t);
        const y = ry * Math.sin(t);
        return [centre + x * cos - y * sin, cy + x * sin + y * cos];
      }),
    );
  });
}

// Checking: ripples moving out from the centre, each gap a little wider than the last.
function ripples(): string[] {
  return Array.from({ length: 14 }, (_, k) =>
    ring(() => 10 + 7 * k + 0.35 * k * k),
  );
}

// Savings: contour lines of a rise, each ring a little rounder than the one inside it.
function contours(): string[] {
  return Array.from({ length: 14 }, (_, k) => {
    const base = 10 + 10 * k;
    const wobble = 0.11 * (1 - k / 20);
    return ring(
      (a) =>
        base *
        (1 +
          wobble * Math.sin(3 * a + 0.45 * k) +
          0.6 * wobble * Math.sin(5 * a - 0.3 * k + 1.2)),
    );
  });
}

const paths: Record<AccountCardKind, string[]> = {
  credit: rosette(),
  checking: ripples(),
  savings: contours(),
};

export function AccountCardArt({ kind }: { kind: AccountCardKind }) {
  const id = useId();
  const fade = `${id}-fade`;
  const mask = `${id}-mask`;
  return (
    <svg
      className={styles.art}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient
          id={fade}
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={cy}
          r="150"
          gradientTransform={`translate(${String(cx)} ${String(cy)}) scale(1 0.52) translate(${String(-cx)} ${String(-cy)})`}
        >
          <stop offset="0" stopColor="white" stopOpacity="1" />
          <stop offset="0.55" stopColor="white" stopOpacity="0.7" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={width}
          height={height}
        >
          <rect width={width} height={height} fill={`url(#${fade})`} />
        </mask>
      </defs>
      <g
        mask={`url(#${mask})`}
        fill="none"
        stroke="white"
        strokeWidth="0.75"
        vectorEffect="non-scaling-stroke"
      >
        {paths[kind].map((d) => (
          <path key={d} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
