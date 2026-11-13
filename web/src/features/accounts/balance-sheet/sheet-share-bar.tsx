import styles from "@/features/accounts/balance-sheet/sheet-share-bar.module.css";

interface SheetShareBarProps {
  // A ratio; a negative share draws the width of its absolute value.
  share: number;
}

// build-own-element: a bar as wide as the share of a group. `progress-indicator` draws a task
// that advances and announces itself as a progressbar, which a share is not; Slotted has no
// family for a static value within a range. The percent beside the title says the value, so the
// bar is decoration and stays out of the accessibility tree.
export function SheetShareBar({ share }: SheetShareBarProps) {
  return (
    <div className={styles.track} aria-hidden="true">
      <div
        className={styles.fill}
        style={{
          inlineSize: `${String(Math.min(100, Math.abs(share) * 100))}%`,
        }}
      />
    </div>
  );
}
