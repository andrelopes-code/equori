import type { ReactNode } from "react";

import { formatMonthShort } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import styles from "@/ui/month-heat/month-heat.module.css";

interface MonthHeadProps {
  // The header of the column of years.
  year: string;
  // The headers after the months.
  children: ReactNode;
}

// The month of any year stands for the column: the names come from the active locale.
const columns = Array.from(
  { length: 12 },
  (_, month) => `2000-${String(month + 1).padStart(2, "0")}`,
);

// The header of a month table: the year, the twelve months and the columns of the caller.
export function MonthHead({ year, children }: MonthHeadProps) {
  const [tag] = useAppLocale();

  return (
    <thead>
      <tr>
        <th scope="col" className={styles.yearCol}>
          {year}
        </th>

        {columns.map((month) => (
          <th key={month} scope="col">
            {formatMonthShort(month, tag)}
          </th>
        ))}

        {children}
      </tr>
    </thead>
  );
}
