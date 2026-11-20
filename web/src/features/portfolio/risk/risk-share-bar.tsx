import styles from "@/features/portfolio/risk/risk-share-bar.module.css";

interface RiskShareBarProps {
  // Share of the portfolio's swing and of its money, in basis points (RK10).
  share: number;
  weight: number;
  // The two values in words: the bar is one image.
  label: string;
}

// Own element: no Slotted family draws a share against a reference mark in a table cell
// (families read: progress-indicator, meter, sparkline). The bar fills to the share of the swing
// and a mark stands at the share of the money; a class whose bar passes its mark swings more than
// its size. A negative share draws no fill.
export function RiskShareBar({ share, weight, label }: RiskShareBarProps) {
  return (
    <span className={styles.track} role="img" aria-label={label}>
      <span
        className={styles.fill}
        style={{ inlineSize: `${String(percentOf(share))}%` }}
      />
      <span
        className={styles.mark}
        style={{ insetInlineStart: `${String(percentOf(weight))}%` }}
      />
    </span>
  );
}

function percentOf(bp: number): number {
  return Math.min(Math.max(bp, 0), 10000) / 100;
}
