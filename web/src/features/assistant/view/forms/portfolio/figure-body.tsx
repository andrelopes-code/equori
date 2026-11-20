import { sparkPath } from "@/features/assistant/view/forms/charts/spark-path";
import type { FigureData } from "@/features/assistant/view/forms/portfolio/portfolio-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// Net worth: the figure, its change over the days read, its line, and the parts it adds up from.
export function FigureBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const d = data as FigureData;
  const series = d.series ?? [];

  return (
    <>
      <div className={styles.figure}>
        <div className={styles.figureText}>
          <span className={styles.figureValue}>{format.money(d.net)}</span>
          {d.change !== undefined && (
            <span
              className={cx(
                styles.figureDelta,
                d.change.amount < 0 ? styles.down : styles.up,
              )}
            >
              {t("assistantView.figure.delta", {
                change: format.delta(d.change),
                days: String(series.length - 1),
              })}
            </span>
          )}
        </div>
        {series.length > 1 && (
          <svg
            className={styles.spark}
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={sparkPath(series.map((s) => s.net.amount))} />
          </svg>
        )}
      </div>

      <div className={styles.parts}>
        <span className={styles.part}>
          <span className={styles.partKey}>
            {t("assistantView.figure.assets")}
          </span>
          <span className={styles.partValue}>{format.money(d.assets)}</span>
        </span>
        <span className={cx(styles.part, styles.partLiability)}>
          <span className={styles.partKey}>
            {t("assistantView.figure.liabilities")}
          </span>
          <span className={styles.partValue}>
            {format.money(d.liabilities)}
          </span>
        </span>
      </div>
    </>
  );
}
