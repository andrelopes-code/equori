import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { PendingValue } from "@/features/portfolio/results/states/pending-value";

interface PendingRowProps {
  label: string;
}

// PX11: a row of the plan's premises while its reads are pending: the label stays, the field waits.
export function PendingRow({ label }: PendingRowProps) {
  return (
    <div className={styles.planRowPending}>
      <span className={styles.planRowLabel}>{label}</span>

      <span className={styles.planRowControl}>
        <PendingValue ch={10} />
      </span>
    </div>
  );
}
