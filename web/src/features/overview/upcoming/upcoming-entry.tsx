import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type {
  Deadline,
  UpcomingEntry as Entry,
} from "@/features/overview/upcoming/upcoming";
import styles from "@/features/overview/upcoming/upcoming.module.css";
import { OccurrenceActions } from "@/features/planning";
import type { MessageKey } from "@/i18n/catalog.en";
import {
  formatDayOfMonth,
  formatRelativeDays,
  formatWeekdayShort,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

type Occurrence = components["schemas"]["Occurrence"];
type ScheduleKind = components["schemas"]["ScheduleKind"];

// The word a kind adds to its deadline; a bill and a subscription add none (UP5).
const kindWords: Partial<Record<ScheduleKind, MessageKey>> = {
  income: "overview.upcoming.income",
  transfer: "overview.upcoming.transfer",
  savings: "overview.upcoming.savings",
};

const deadlineTones: Record<Deadline, "danger" | "warning" | "muted"> = {
  overdue: "danger",
  late: "warning",
  ahead: "muted",
};

const separator = " · ";

interface UpcomingEntryProps {
  entry: Entry<Occurrence>;
  scale: (currency: string) => number;
}

// Families read: list-item, timeline, data-list. A list item centres one icon or control at its
// start and takes its height from its content; a timeline draws a rail and a marker per event;
// a data list pairs a label with a value. This row holds a day column of two lines, a name over
// its deadline, an amount and the actions, at a fixed height (UP9). It is a form of this widget,
// not a Slotted finding.
export function UpcomingEntry({ entry, scale }: UpcomingEntryProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const { occurrence, deadline } = entry;
  const name = entry.name ?? t("ledger.untitled");
  const when = formatRelativeDays(entry.days, locale);
  const word = kindWords[entry.kind];
  const income = entry.direction === "in";
  const amount = occurrence.expected_amount;
  const late = deadline !== "ahead";
  const deadlineText = deadlineWords(deadline, when, t);
  const line =
    word === undefined ? deadlineText : deadlineText + separator + t(word);

  return (
    <li
      className={styles.entry}
      data-part="entry"
      data-today={entry.today ? "" : undefined}
    >
      {entry.repeated && <span className={styles.date} aria-hidden="true" />}

      {!entry.repeated && (
        <span className={styles.date}>
          <Text
            className={styles.dayNumber}
            weight="semibold"
            numeric="tabular"
          >
            {formatDayOfMonth(occurrence.expected_on, locale)}
          </Text>
          <Text size="xs" tone="muted">
            {formatWeekdayShort(occurrence.expected_on, locale)}
          </Text>
        </span>
      )}

      <span className={styles.what}>
        <Text className={styles.name}>{name}</Text>
        <Text
          size="sm"
          tone={deadlineTones[deadline]}
          {...(late ? { weight: "medium" as const } : {})}
        >
          {line}
        </Text>
      </span>

      <Text
        className={styles.amount}
        weight="semibold"
        numeric="tabular"
        tone={income ? "success" : "default"}
      >
        <MoneyFigure
          amount={amount.amount}
          currency={amount.currency}
          scale={scale(amount.currency)}
          plus={income}
        />
      </Text>

      <span className={styles.actions}>
        <OccurrenceActions occurrence={occurrence} name={name} />
      </span>
    </li>
  );
}

function deadlineWords(
  deadline: Deadline,
  when: string,
  t: ReturnType<typeof useT>,
): string {
  if (deadline === "overdue")
    return t("overview.upcoming.overdueSince", { when });
  if (deadline === "late")
    return t("overview.upcoming.expectedSince", { when });

  return when;
}
