import type { CSSProperties } from "react";

import { monthLabel } from "@/features/assistant/view/forms/month-label";
import { seriesCols } from "@/features/assistant/view/forms/series-cols";
import type { SeriesData } from "@/features/assistant/view/forms/series-cols";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// A monthly series: one column per month, the last closed month in the accent, the open month
// hatched, the average of the closed months as a dashed line.
export function SeriesBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();
  const series = data as SeriesData;
  const { cols, average } = seriesCols(series);

  return (
    <>
      <div>
        <div
          className={styles.cols}
          style={{ "--n": cols.length } as CSSProperties}
        >
          {cols.map((col, index) => (
            <span
              key={col.month}
              tabIndex={0}
              className={cx(
                styles.col,
                col.focus && styles.colFocus,
                col.partial && styles.colPartial,
                index < 2 && styles.tipStart,
                index >= cols.length - 3 && styles.tipEnd,
              )}
              style={{ "--h": `${String(col.height)}%` } as CSSProperties}
              aria-label={`${monthLabel(col.month, locale)} ${format.money(col.amount)}`}
            >
              <i />
              <span className={styles.colTip}>
                {t("assistantView.series.tip", {
                  month: monthLabel(col.month, locale),
                  amount: format.money(col.amount),
                })}
              </span>
            </span>
          ))}
          <span
            className={styles.avg}
            style={{ insetBlockEnd: `${String(average)}%` }}
          >
            <span className={styles.avgLabel}>
              {t("assistantView.series.average", {
                amount: format.money(series.average),
              })}
            </span>
          </span>
        </div>

        <div
          className={styles.colAxis}
          style={{ "--n": cols.length } as CSSProperties}
        >
          {cols.map((col) => (
            <span key={col.month}>{monthLabel(col.month, locale)}</span>
          ))}
        </div>
      </div>

      <ul className={styles.legend}>
        <li>
          <i className={styles.key} />
          {t("assistantView.series.legend_focus")}
        </li>
        {cols.some((c) => c.partial) && (
          <li>
            <i className={styles.keyPartial} />
            {t("assistantView.series.legend_partial")}
          </li>
        )}
      </ul>
    </>
  );
}
