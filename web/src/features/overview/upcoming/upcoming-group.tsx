import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { UpcomingEntry as Entry } from "@/features/overview/upcoming/upcoming";
import { UpcomingEntry } from "@/features/overview/upcoming/upcoming-entry";
import styles from "@/features/overview/upcoming/upcoming.module.css";
import { formatDayMonthNumeric, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

type Occurrence = components["schemas"]["Occurrence"];
type Money = components["schemas"]["Money"];

interface UpcomingGroupProps {
  kind: "late" | "next";
  entries: readonly Entry<Occurrence>[];
  // The overdue amounts in the base currency, the end of the late group's head.
  sum: Money;
  // The last day of the window, the end of the next group's head.
  until: string;
  scale: (currency: string) => number;
}

// One group of the agenda: its head and its rows. A group without rows draws nothing (UP2).
export function UpcomingGroup({
  kind,
  entries,
  sum,
  until,
  scale,
}: UpcomingGroupProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (entries.length === 0) return null;

  const late = kind === "late";
  const label = t(late ? "overview.upcoming.late" : "overview.upcoming.next");
  const count = numberFormatter(locale).format(entries.length);

  return (
    <section className={styles.group} data-late={late ? "" : undefined}>
      {late && (
        <div className={styles.groupHead}>
          <Text size="sm" tone="danger" weight="medium">
            {t("overview.upcoming.lateCount", { count })}
          </Text>
          <Text size="sm" tone="danger" weight="semibold" numeric="tabular">
            <MoneyFigure
              amount={sum.amount}
              currency={sum.currency}
              scale={scale(sum.currency)}
            />
          </Text>
        </div>
      )}

      {!late && (
        <div className={styles.groupHead}>
          <Text size="sm" tone="muted" weight="medium">
            {label}
          </Text>
          <Text size="sm" tone="muted" numeric="tabular">
            {t("overview.upcoming.until", {
              date: formatDayMonthNumeric(until, locale),
            })}
          </Text>
        </div>
      )}

      <ul className={styles.entries} role="list" aria-label={label}>
        {entries.map((entry) => (
          <UpcomingEntry
            key={entry.occurrence.id}
            entry={entry}
            scale={scale}
          />
        ))}
      </ul>
    </section>
  );
}
