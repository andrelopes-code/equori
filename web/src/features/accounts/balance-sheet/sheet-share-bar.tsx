import { Meter } from "@slotted/react/meter";

import styles from "@/features/accounts/balance-sheet/sheet-share-bar.module.css";

interface SheetShareBarProps {
  // A ratio; a negative share draws the width of its absolute value.
  share: number;
}

// The percent beside the title says the value, so the meter is decorative.
export function SheetShareBar({ share }: SheetShareBarProps) {
  return (
    <Meter
      decorative
      size="sm"
      max={1}
      value={Math.abs(share)}
      className={styles.track}
    />
  );
}
