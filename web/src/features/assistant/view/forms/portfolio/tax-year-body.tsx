import type { CSSProperties } from "react";

import { monthLabel } from "@/features/assistant/view/forms/charts/month-label";
import type { TaxYearData } from "@/features/assistant/view/forms/portfolio/portfolio-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// The tax year by month: each month's result as a column, the months that owe tax in the accent,
// and those months listed with what they owe.
export function TaxYearBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();
  const d = data as TaxYearData;

  const largest = Math.max(
    1,
    ...d.months.map((m) => Math.abs(m.result.amount)),
  );
  const owing = d.months.filter((m) => m.due.amount > 0);

  return (
    <>
      <div>
        <div
          className={styles.cols}
          style={{ "--n": d.months.length } as CSSProperties}
        >
          {d.months.map((m, i) => (
            <span
              key={m.month}
              tabIndex={0}
              className={cx(
                styles.col,
                m.due.amount > 0 && styles.colFocus,
                i < 2 && styles.tipStart,
                i >= d.months.length - 3 && styles.tipEnd,
              )}
              style={
                {
                  "--h": `${String((Math.max(m.result.amount, 0) / largest) * 100)}%`,
                } as CSSProperties
              }
            >
              <i />
              <span className={styles.colTip}>
                {t("assistantView.tax_year.tip", {
                  month: monthLabel(m.month, locale),
                  result: format.money(m.result),
                  due: format.money(m.due),
                })}
              </span>
            </span>
          ))}
        </div>
        <div
          className={styles.colAxis}
          style={{ "--n": d.months.length } as CSSProperties}
        >
          {d.months.map((m) => (
            <span key={m.month}>{monthLabel(m.month, locale)}</span>
          ))}
        </div>
      </div>

      <ul className={styles.events}>
        {owing.map((m) => (
          <li key={m.month} className={styles.event}>
            <span className={styles.day}>
              <b>{monthLabel(m.month, locale)}</b>
            </span>
            <span className={styles.eventText}>
              <span className={styles.eventName}>
                {t("assistantView.tax_year.result", {
                  result: format.money(m.result),
                })}
              </span>
            </span>
            <span className={styles.eventValue}>{format.money(m.due)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
