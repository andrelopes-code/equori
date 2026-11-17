import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { nextDates } from "@/features/assistant/proposal/bodies/next-dates";
import {
  changeOf,
  changesWithout,
} from "@/features/assistant/proposal/preview-field";
import { ProposalChanges } from "@/features/assistant/proposal/proposal-changes";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Preview = components["schemas"]["AssistantPreview"];

interface ScheduleBodyProps {
  preview: Preview;
}

// Families read: typography. The amount per period and the next six occurrences of a monthly
// rule, or the terms text for any other frequency.
export function ScheduleBody({ preview }: ScheduleBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const valueText = useValueText();
  const { recurrence } = preview;
  const amount = valueText(changeOf(preview, "amount")?.after);
  const account = valueText(changeOf(preview, "account")?.after);
  const terms = valueText(changeOf(preview, "terms")?.after);
  const start = changeOf(preview, "date")?.after?.date;
  const dates =
    recurrence !== undefined && start !== undefined
      ? nextDates(start, recurrence)
      : [];
  const perKey = catalogKey(
    `assistant.body.per.${recurrence?.frequency ?? ""}`,
  );
  const per = [perKey === undefined ? undefined : t(perKey), account]
    .filter((part) => part !== undefined)
    .join(" · ");
  const drawn = ["schedule", "amount", "account", "terms"];
  const rest = changesWithout(
    preview,
    dates.length > 0 ? [...drawn, "date"] : drawn,
  );

  return (
    <div className={styles.body}>
      {amount !== undefined && (
        <div className={styles.money}>
          <Text size="lg" weight="semibold" className={styles.big}>
            {amount}
          </Text>
          <Text size="sm" tone="muted">
            {per}
          </Text>
        </div>
      )}

      {dates.length > 0 && (
        <ul className={styles.months}>
          {dates.map((date, i) => (
            <li
              key={date}
              className={
                i === 0 ? cx(styles.month, styles.monthFirst) : styles.month
              }
            >
              <span className={styles.dot} aria-hidden="true" />
              <Text size="xs">{formatDayMonth(date, locale)}</Text>
            </li>
          ))}
        </ul>
      )}

      {dates.length === 0 && terms !== undefined && (
        <Text size="sm" tone="muted">
          {terms}
        </Text>
      )}

      <ProposalChanges changes={rest} />
    </div>
  );
}
