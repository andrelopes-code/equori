import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import { cx } from "@/ui/cx";

interface LifeHeadProps {
  // The stretch that follows the stop: solid for the contributions, dashed for the withdrawals.
  line: "before" | "after" | null;
  text?: string | undefined;
}

// PX17: the dot of a stop on the line of the plan, and the stretch to the next stop with its years.
export function LifeHead({ line, text }: LifeHeadProps) {
  return (
    <div className={styles.lifeHead}>
      <span className={styles.lifeDot} aria-hidden="true" />

      {line !== null && (
        <span
          className={cx(
            styles.lifeLine,
            line === "before" ? styles.lifeLineBefore : styles.lifeLineAfter,
          )}
        >
          {text !== undefined && (
            <span className={styles.lifeSpan}>{text}</span>
          )}
        </span>
      )}
    </div>
  );
}
