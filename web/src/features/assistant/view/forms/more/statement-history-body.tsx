import type { CSSProperties } from "react";

import { monthLabel } from "@/features/assistant/view/forms/charts/month-label";
import type { StatementHistoryData } from "@/features/assistant/view/forms/more/more-data";
import { slot } from "@/features/assistant/view/forms/more/slot";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

const PARTS = ["purchases", "installments", "charges"] as const;

// A card's closed statements as stacked columns of purchases, installments and charges.
export function StatementHistoryBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();
  const { statements } = data as StatementHistoryData;

  const largest = Math.max(1, ...statements.map((s) => s.parts.total.amount));
  const h = (amount: number) =>
    `${String((Math.max(amount, 0) / largest) * 100)}%`;

  return (
    <>
      <div>
        <div
          className={cx(styles.cols, styles.stk)}
          style={{ "--n": statements.length } as CSSProperties}
        >
          {statements.map((s, i) => (
            <span
              key={s.reference}
              tabIndex={0}
              className={cx(
                styles.col,
                i < 2 && styles.tipStart,
                i >= statements.length - 3 && styles.tipEnd,
              )}
              style={{ "--h": h(s.parts.total.amount) } as CSSProperties}
            >
              {PARTS.map((p, j) => (
                <i
                  key={p}
                  style={
                    {
                      "--h": h(s.parts[p].amount),
                      "--fill": slot(j),
                    } as CSSProperties
                  }
                />
              ))}
              <span className={styles.colTip}>
                {t("assistantView.series.tip", {
                  month: monthLabel(s.reference, locale),
                  amount: format.money(s.parts.total),
                })}
              </span>
            </span>
          ))}
        </div>
        <div
          className={styles.colAxis}
          style={{ "--n": statements.length } as CSSProperties}
        >
          {statements.map((s) => (
            <span key={s.reference}>{monthLabel(s.reference, locale)}</span>
          ))}
        </div>
      </div>

      <ul className={styles.legend}>
        {PARTS.map((p, j) => (
          <li key={p}>
            <i
              className={styles.key}
              style={
                {
                  "--fill": slot(j),
                  background: "var(--fill)",
                } as CSSProperties
              }
            />
            {t(`assistantView.statement.${p}`)}
          </li>
        ))}
      </ul>
    </>
  );
}
