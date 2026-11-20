import { useState } from "react";

import { HoldingsHead } from "@/features/assistant/view/forms/portfolio/holdings-head";
import type { HoldingsData } from "@/features/assistant/view/forms/portfolio/portfolio-data";
import { sortHoldings } from "@/features/assistant/view/forms/portfolio/sort-holdings";
import type { HoldingsKey } from "@/features/assistant/view/forms/portfolio/sort-holdings";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

// The positions as a table that sorts by value, result or weight; the weight also as a bar.
export function HoldingsBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const d = data as HoldingsData;

  const [key, setKey] = useState<HoldingsKey>("value");

  const rows = sortHoldings(d.rows, key);
  const signed = (bp: number) =>
    `${bp > 0 ? "+" : ""}${valueText({ rate: bp }, format)}`;

  return (
    <table className={styles.tbl}>
      <HoldingsHead sorted={key} onSort={setKey} />
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.account}-${r.instrument}`}>
            <td>{r.instrument}</td>
            <td>{format.money(r.value)}</td>
            <td className={cx(r.result_bp < 0 ? styles.down : styles.up)}>
              {signed(r.result_bp)}
            </td>
            <td>
              <span className={styles.alloc}>
                <i style={{ inlineSize: `${String(r.weight_bp / 100)}%` }} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>{t("assistantView.holdings.total")}</td>
          <td>{format.money(d.value)}</td>
          <td className={cx(d.result_bp < 0 ? styles.down : styles.up)}>
            {signed(d.result_bp)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
