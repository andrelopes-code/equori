import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";

interface PendingStopProps {
  label: string;
}

// PX11: a field of the plan's line while its reads are pending: the label stays, the value waits.
export function PendingStop({ label }: PendingStopProps) {
  return (
    <div className={styles.lifeFact}>
      <p className={styles.lifeLabel}>{label}</p>

      <span className={styles.lifeAge}>
        <PendingValue ch={8} />
      </span>
    </div>
  );
}
