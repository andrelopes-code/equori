import { Meter } from "@slotted/react/meter";

import styles from "@/features/portfolio/allocation/share-bar.module.css";

interface ShareBarProps {
  // Basis points of the whole.
  share: number;
}

// A share is a length beside the words that state it: the row's percent is what assistive
// technology reads, so the meter is decorative.
export function ShareBar({ share }: ShareBarProps) {
  return (
    <Meter
      decorative
      size="sm"
      max={10000}
      value={Math.max(0, share)}
      className={styles.track}
    />
  );
}
