import type { CSSProperties } from "react";

import {
  firstWeekday,
  heatGrid,
} from "@/features/assistant/view/forms/ledger/heat-grid";
import type { HeatData } from "@/features/assistant/view/forms/ledger/view-data";
import { WeekdayHeads } from "@/features/assistant/view/forms/ledger/weekday-heads";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// A month as a calendar: each day's spending as the strength of one accent, the days to come
// dimmed, the weeks starting on the locale's first weekday.
export function HeatBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();
  const heat = data as HeatData;

  const first = firstWeekday(locale);
  const { blanks, cells } = heatGrid(
    heat.month,
    heat.days.map((d) => d.amount),
    heat.until,
    first,
  );

  return (
    <>
      <div className={styles.heat}>
        <WeekdayHeads firstDay={first} />
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${String(i)}`} className={styles.cellBlank} />
        ))}
        {cells.map((cell, i) => (
          <span
            key={cell.day}
            tabIndex={cell.level === undefined ? undefined : 0}
            className={cx(
              styles.heatCell,
              cell.level === undefined && styles.heatFuture,
              (cell.level ?? 0) >= 0.6 && styles.heatHigh,
              (blanks + i) % 7 >= 5 && styles.tipEnd,
            )}
            style={
              { "--v": `${String((cell.level ?? 0) * 100)}%` } as CSSProperties
            }
          >
            {cell.day}
            {cell.level !== undefined && heat.days[i] !== undefined && (
              <span className={styles.tip}>
                {t("assistantView.heat.tip", {
                  day: String(cell.day),
                  amount: format.money(heat.days[i]),
                })}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className={styles.ramp}>
        <span>{t("assistantView.heat.less")}</span>
        {[0.1, 0.35, 0.65, 1].map((v) => (
          <i
            key={v}
            style={{ "--v": `${String(v * 100)}%` } as CSSProperties}
          />
        ))}
        <span>{t("assistantView.heat.more")}</span>
      </div>
    </>
  );
}
