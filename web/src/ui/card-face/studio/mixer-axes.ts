import type { MessageKey } from "@/i18n/catalog.en";

export type Axis = "h" | "c" | "l";

export interface Mix {
  l: number;
  c: number;
  h: number;
}

export interface AxisSpec {
  axis: Axis;
  label: MessageKey;
  min: number;
  max: number;
  step: number;
  scale: number;
  format: Intl.NumberFormatOptions;
}

const hueStops = [0, 45, 90, 135, 180, 225, 270, 315, 360];
const minimumTrackChroma = 0.08;

export const axes: readonly AxisSpec[] = [
  {
    axis: "h",
    label: "cardFace.studio.hue",
    min: 0,
    max: 360,
    step: 1,
    scale: 1,
    format: { style: "unit", unit: "degree", maximumFractionDigits: 0 },
  },
  {
    axis: "c",
    label: "cardFace.studio.chroma",
    min: 0,
    max: 0.3,
    step: 0.002,
    scale: 0.3,
    format: { style: "percent", maximumFractionDigits: 0 },
  },
  {
    axis: "l",
    label: "cardFace.studio.lightness",
    min: 0.15,
    max: 0.97,
    step: 0.005,
    scale: 1,
    format: { style: "percent", maximumFractionDigits: 0 },
  },
];

// The track of one slider shows the colours the other two axes would give along it.
export function trackOf(axis: Axis, mix: Mix): string {
  const l = mix.l.toFixed(3);
  const c = mix.c.toFixed(3);
  const h = mix.h.toFixed(1);

  if (axis === "h") {
    const chroma = Math.max(mix.c, minimumTrackChroma).toFixed(3);
    const stops = hueStops.map((hue) => `oklch(${l} ${chroma} ${String(hue)})`);

    return `linear-gradient(to right, ${stops.join(", ")})`;
  }

  if (axis === "c") {
    return `linear-gradient(to right, oklch(${l} 0 ${h}), oklch(${l} 0.3 ${h}))`;
  }

  return [
    "linear-gradient(to right,",
    `oklch(0.15 ${c} ${h}),`,
    `oklch(0.56 ${c} ${h}),`,
    `oklch(0.97 ${c} ${h}))`,
  ].join(" ");
}
