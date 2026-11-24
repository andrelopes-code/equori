import { Loader } from "@slotted/react/progress-indicator";

import type { FeedStatus } from "@/features/setup/market-data/feed-status";
import styles from "@/features/setup/market-data/market-data.module.css";

interface FeedMarkProps {
  tone: FeedStatus["tone"];
  running: boolean;
}

// The mark of a state, in a column of its own: the marks of every row and band share one axis, and the
// loader of a run takes the box of the dot, so nothing moves when a run starts or ends. The word beside
// it says the state, so the mark is decorative.
export function FeedMark({ tone, running }: FeedMarkProps) {
  return (
    <span className={styles.mark} aria-hidden="true">
      {running ? (
        <Loader size="sm" decorative className={styles.loader} />
      ) : (
        <span className={styles.dot} data-tone={tone} />
      )}
    </span>
  );
}
