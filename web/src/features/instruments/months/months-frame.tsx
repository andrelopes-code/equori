import type { ReactNode } from "react";

import styles from "@/features/instruments/months/months.module.css";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";
import { MonthHead } from "@/ui/month-heat/month-head";
import heat from "@/ui/month-heat/month-heat.module.css";

interface MonthsFrameProps {
  // The sentence a screen reader hears before the table; absent while it loads.
  caption?: string;
  // The rows.
  children: ReactNode;
}

// IM2: the columns of the block: the year, the twelve months, the year change and the last price.
export function MonthsFrame({ caption, children }: MonthsFrameProps) {
  const t = useT();

  return (
    <div className={heat.monthScroll}>
      <table className={cx(heat.monthTable, styles.table)}>
        {caption !== undefined && (
          <caption className={heat.srOnly}>{caption}</caption>
        )}

        <MonthHead year={t("instrument.months.year")}>
          <th scope="col" className={styles.sumCol}>
            {t("instrument.months.year")}
          </th>

          <th scope="col" className={styles.priceCol}>
            {t("instrument.months.end")}
          </th>
        </MonthHead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
