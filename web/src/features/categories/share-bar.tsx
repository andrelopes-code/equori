import styles from "@/features/categories/share-bar.module.css";

// Families read: progress-indicator, sparkline. A progress bar says how far a task went; a share
// of a total painted in the category's own colour is the app's own. The number beside it is the
// value; the bar repeats it and stays out of the accessibility tree.
export function ShareBar({
  share,
  color,
}: {
  // 0 to 1.
  share: number;
  color?: number | undefined;
}) {
  const width = `${String(Math.max(0, Math.min(1, share)) * 100)}%`;
  return (
    <span className={styles.track} aria-hidden="true">
      <span
        className={styles.fill}
        data-color={color}
        style={{ inlineSize: width }}
      />
    </span>
  );
}
