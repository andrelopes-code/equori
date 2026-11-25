import type { CSSProperties } from "react";

import styles from "@/features/portfolio/contribution-plan/list/plan-list.module.css";

interface ShareOfContributionProps {
  // The part of the contribution, from 0 to 1; undefined without a purchase.
  fraction: number | undefined;
  // The position of the group in the plan: its colour of the data palette.
  position: number;
}

const paletteSize = 8;

// The part of the contribution as a bar. The percentage beside it says the same, so it is hidden
// from assistive technology.
export function ShareOfContribution({
  fraction,
  position,
}: ShareOfContributionProps) {
  const style = {
    "--share": Math.round((fraction ?? 0) * 100),
    "--ink": `var(--slotted-data-${String((position % paletteSize) + 1)})`,
  } as CSSProperties;

  return <span aria-hidden="true" className={styles.share} style={style} />;
}
