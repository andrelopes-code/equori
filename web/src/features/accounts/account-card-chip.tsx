import styles from "@/features/accounts/account-card.module.css";

// The short series beside its legend and sum; the bars are drawn, the label carries the meaning.
export function AccountCardChip({
  signal,
  legend,
  sum,
  name,
}: {
  signal: readonly number[];
  legend: string;
  sum: string;
  name: string;
}) {
  const max = Math.max(...signal, 0);
  return (
    <div className={styles.chip} role="img" aria-label={name}>
      <span className={styles.chipBox} aria-hidden="true">
        {signal.map((value, i) => (
          <span
            key={i}
            className={styles.chipBar}
            data-last={i === signal.length - 1 || undefined}
            style={{
              blockSize: `${String(Math.max(8, max > 0 ? (value * 100) / max : 0))}%`,
            }}
          />
        ))}
      </span>
      <span className={styles.chipText} aria-hidden="true">
        <span className={styles.secondary}>{legend}</span>
        <span className={styles.chipSum}>{sum}</span>
      </span>
    </div>
  );
}
