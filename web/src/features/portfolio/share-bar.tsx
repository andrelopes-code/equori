import styles from "@/features/portfolio/share-bar.module.css";

interface ShareBarProps {
  // Basis points of the whole.
  share: number;
}

// Workaround for Slotted issue #82: no family draws a share. Families read: progress-indicator,
// whose role and end mark state a task under way, and sparkline, which draws a series. A share is
// a length beside the words that state it, so the element holds no role of its own: the row's
// percent is what assistive technology reads.
export function ShareBar({ share }: ShareBarProps) {
  return (
    <div className={styles.track} aria-hidden="true">
      <div
        className={styles.fill}
        style={{ inlineSize: `${String(Math.max(0, share) / 100)}%` }}
      />
    </div>
  );
}
