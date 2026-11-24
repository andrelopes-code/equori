import { Button } from "@slotted/react/button";
import { useState } from "react";

import { priceDigits } from "@/features/instruments/model/price-stats";
import type { YearChanges } from "@/features/instruments/months/month-changes";
import { MonthsFrame } from "@/features/instruments/months/months-frame";
import { MonthsRow } from "@/features/instruments/months/months-row";
import styles from "@/features/instruments/months/months.module.css";
import { useT } from "@/i18n/i18n-provider";

interface MonthsTableProps {
  // Newest year first; at least one.
  rows: YearChanges[];
  quote: string;
}

const shownYears = 12;

// IM2, IM7, IM8: the years of the series, the first twelve until the rest is asked for.
export function MonthsTable({ rows, quote }: MonthsTableProps) {
  const t = useT();

  const [all, setAll] = useState(false);

  const shown = all ? rows : rows.slice(0, shownYears);
  const digits = priceDigits(rows[0]?.end.value ?? "0");
  const toggle = all
    ? t("instrument.months.fewer", { count: shownYears })
    : t("instrument.months.all", { count: rows.length });

  return (
    <>
      <MonthsFrame caption={t("instrument.months.caption", { quote })}>
        {shown.map((row) => (
          <MonthsRow key={row.year} row={row} digits={digits} />
        ))}
      </MonthsFrame>

      {rows.length > shownYears && (
        <div className={styles.moreRow}>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            aria-expanded={all}
            onClick={() => {
              setAll(!all);
            }}
          >
            {toggle}
          </Button>
        </div>
      )}
    </>
  );
}
