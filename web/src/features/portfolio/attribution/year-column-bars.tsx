import styles from "@/features/portfolio/attribution/year-columns.module.css";
import {
  heightOf,
  type YearColumn,
  type YearScale,
} from "@/features/portfolio/attribution/year-scale";
import { cx } from "@/ui/cx";

interface YearColumnBarsProps {
  column: YearColumn;
  scale: YearScale;
}

// The plot of one year: the zero line, the bar of the portfolio and, when the year has it, the
// thinner bar of the same money at the CDI beside it, both on the axis of every year.
export function YearColumnBars({ column, scale }: YearColumnBarsProps) {
  const zero = heightOf(scale, 0);
  const value = column.returnBp ?? 0;

  return (
    <span className={styles.plot} aria-hidden="true">
      <span className={styles.zero} style={{ bottom: `${String(zero)}%` }} />
      <span className={styles.pair}>
        <span
          className={cx(
            styles.bar,
            styles.portfolio,
            value < 0 && styles.negative,
          )}
          style={span(scale, value)}
        />
        {column.rateBp !== undefined && (
          <span
            className={cx(styles.bar, styles.rate)}
            style={span(scale, column.rateBp)}
          />
        )}
      </span>
    </span>
  );
}

function span(scale: YearScale, value: number) {
  const top = heightOf(scale, Math.max(value, 0));
  const bottom = heightOf(scale, Math.min(value, 0));

  return { bottom: `${String(bottom)}%`, height: `${String(top - bottom)}%` };
}
