import styles from "@/features/planning/income-split/bucket-track.module.css";

interface BucketGaugeProps {
  // The accessible name with the values the gauge draws.
  label: string;
  real: number;
  target: number | undefined;
  missed: boolean;
}

// The target sits at two thirds of the track; a real amount above one and a half targets
// fills the track. Built here: no family draws a bar against a target mark, and a meter has
// no second mark. The hatching tells a missed target apart without colour.
const targetAt = 2 / 3;

export function BucketGauge({ label, real, target, missed }: BucketGaugeProps) {
  const ratio =
    target === undefined || target <= 0 ? 0 : Math.max(real, 0) / target;
  const fill = Math.min(ratio * targetAt, 1) * 100;

  return (
    <div className={styles.gauge} role="img" aria-label={label}>
      <div
        className={styles.fill}
        style={{ inlineSize: `${String(fill)}%` }}
        {...(missed ? { "data-missed": "" } : {})}
      />
      {target !== undefined && (
        <div
          className={styles.tick}
          style={{ insetInlineStart: `${String(targetAt * 100)}%` }}
        />
      )}
    </div>
  );
}
