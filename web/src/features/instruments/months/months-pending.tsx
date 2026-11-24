import { Skeleton } from "@slotted/react/skeleton";

import { MonthFact } from "@/features/instruments/months/month-fact";
import { MonthsFrame } from "@/features/instruments/months/months-frame";
import { MonthsPendingRow } from "@/features/instruments/months/months-pending-row";
import { MonthsSection } from "@/features/instruments/months/months-section";
import styles from "@/features/instruments/months/months.module.css";
import { useT } from "@/i18n/i18n-provider";

const facts = [
  ["instrument.months.best", "16ch"],
  ["instrument.months.worst", "16ch"],
  ["instrument.months.up", "9ch"],
  ["instrument.months.down", "9ch"],
] as const;

const years = [0, 1, 2, 3];

// IM9: the block while its read is pending.
export function MonthsPending() {
  const t = useT();

  return (
    <MonthsSection busy>
      <dl className={styles.factStrip}>
        {facts.map(([label, size]) => (
          <MonthFact key={label} label={t(label)}>
            <Skeleton shape="text" inlineSize={size} />
          </MonthFact>
        ))}
      </dl>

      <MonthsFrame>
        {years.map((year) => (
          <MonthsPendingRow key={year} />
        ))}
      </MonthsFrame>
    </MonthsSection>
  );
}
