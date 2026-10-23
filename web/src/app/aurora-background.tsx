import type { CSSProperties } from "react";
import { useState } from "react";

import styles from "@/app/aurora-background.module.css";
import { useGlass } from "@/theme/visual";

// A still gradient behind the whole application, drawn under the glass theme (theme/glass). The
// four lights are placed at random once, when the component mounts, and never move.
const TONES = ["accent", "info", "secondary", "success"] as const;

// One anchor per light, as percent of the viewport. Each tone takes a random anchor and drifts
// from it by a random offset, so the lights spread over the screen without gathering in one spot.
const ANCHORS: readonly (readonly [number, number])[] = [
  [14, 10],
  [88, 92],
  [94, 34],
  [12, 88],
];
const JITTER = 12;

const between = (min: number, max: number) => min + Math.random() * (max - min);

function scatter(): CSSProperties {
  const tones = TONES.map((tone) => ({ tone, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ tone }) => tone);
  const vars: Record<string, string> = {};
  tones.forEach((tone, i) => {
    const anchor = ANCHORS[i];
    if (anchor === undefined) return;
    const [x, y] = anchor;
    vars[`--${tone}-x`] = `${(x + between(-JITTER, JITTER)).toFixed(1)}%`;
    vars[`--${tone}-y`] = `${(y + between(-JITTER, JITTER)).toFixed(1)}%`;
    vars[`--${tone}-rx`] = `${between(46, 80).toFixed(1)}%`;
    vars[`--${tone}-ry`] = `${between(34, 56).toFixed(1)}%`;
  });
  return vars;
}

export function AuroraBackground() {
  const glass = useGlass();
  const [lights] = useState(scatter);

  if (!glass) return null;

  return <div className={styles.aurora} style={lights} aria-hidden="true" />;
}
