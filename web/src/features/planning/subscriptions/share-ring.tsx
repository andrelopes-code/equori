import styles from "@/features/planning/subscriptions/subscriptions.module.css";

interface ShareRingProps {
  // The share of the total in basis points.
  bp: number;
}

// The share of one subscription in the total as a ring beside its percentage, decorative: the
// percentage carries the value (spec C3). Built here: ProgressCircle draws a wait, with a
// progressbar role and a delay, not a static part of a whole.
export function ShareRing({ bp }: ShareRingProps) {
  return (
    <svg className={styles.ring} viewBox="0 0 20 20" aria-hidden="true">
      <circle className={styles.ringTrack} cx="10" cy="10" r="8" />
      <circle
        className={styles.ringArc}
        cx="10"
        cy="10"
        r="8"
        pathLength={10000}
        strokeDasharray={`${String(bp)} 10000`}
      />
    </svg>
  );
}
