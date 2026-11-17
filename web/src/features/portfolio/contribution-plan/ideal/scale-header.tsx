import styles from "@/features/portfolio/contribution-plan/ideal/scale-header.module.css";
import { cx } from "@/ui/cx";

const ticks = [0, 25, 50, 75, 100];

// The scale of every bar, written once above the first row. The bars repeat it in their
// gridlines and say their shares in words, so the numbers are hidden from assistive technology.
export function ScaleHeader() {
  return (
    <div aria-hidden="true" className={styles.head}>
      <div className={styles.scale}>
        {ticks.map((tick) => (
          <span
            key={tick}
            className={cx(
              styles.tick,
              tick === 0 ? styles.first : "",
              tick === 100 ? styles.last : "",
            )}
            style={{ insetInlineStart: `${String(tick)}%` }}
          >
            {tick === 100 ? "100%" : tick}
          </span>
        ))}
      </div>
    </div>
  );
}
