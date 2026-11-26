import type { CSSProperties } from "react";

import type { WalletHistory } from "@/features/overview/cards/wallet";
import styles from "@/features/overview/cards/wallet.module.css";

interface FaceTrendProps {
  history: WalletHistory;
}

// The months engraved on a face, right of the chip: the closed statements in a share of the
// face's ink, the open one in its full ink, the mean dashed (CD5). The panel holds them in
// words.
export function FaceTrend({ history }: FaceTrendProps) {
  if (history.bars.length === 0) return null;

  const style = {
    "--bars": String(history.bars.length),
    "--mean": String(history.meanHeight),
  } as CSSProperties;

  return (
    <span className={styles.faceTrend} style={style} aria-hidden="true">
      {history.bars.map((bar, j) => (
        <span
          key={bar.reference}
          className={styles.trendBar}
          style={
            { "--j": String(j), "--h": String(bar.height) } as CSSProperties
          }
          data-open={bar.open ? "" : undefined}
        />
      ))}
      <span className={styles.trendMean} />
    </span>
  );
}
