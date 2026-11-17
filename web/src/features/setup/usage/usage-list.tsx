import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";
import { useMemo } from "react";

import type { UsageRow } from "@/features/setup/api";
import card from "@/features/setup/assistant/assistant-card.module.css";
import { UsageChart } from "@/features/setup/usage/usage-chart";
import styles from "@/features/setup/usage/usage-details.module.css";
import { UsageItem } from "@/features/setup/usage/usage-item";
import { UsageSummaryLine } from "@/features/setup/usage/usage-summary-line";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface UsageListProps {
  rows: readonly UsageRow[];
  now: Date;
  onLimits: (row: UsageRow) => void;
}

// The usage of the assistant (spec A8): a card that starts closed on one line of today's state
// and opens on the figures per provider and model, against the declared limits (ADR 019 U7).
// Element of the app's own. Family read: Collapsible (its trigger holds a label and a
// description under it, with no summary at the end of the line, and it draws no card).
export function UsageList({ rows, now, onLimits }: UsageListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const number = useMemo(() => numberFormatter(locale), [locale]);
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );

  const days = rows[0]?.period_days ?? 30;

  return (
    <details className={cx(card.card, styles.details)}>
      <summary className={styles.summary}>
        <Text size="md" weight="medium" truncate>
          {t("assistant.usage")}
        </Text>
        <UsageSummaryLine rows={rows} now={now} number={number} />
        <span className={styles.mark} aria-hidden="true">
          <Icon>
            <Glyph name="chevron-down" />
          </Icon>
        </span>
      </summary>

      <div className={styles.heads}>
        <Text size="xs" tone="muted">
          {t("assistant.usage.head.model")}
        </Text>
        <Text size="xs" tone="muted" align="end">
          {t("assistant.usage.meter.requests")}
        </Text>
        <Text size="xs" tone="muted" align="end">
          {t("assistant.usage.meter.tokens")}
        </Text>
        <Text size="xs" tone="muted">
          {t("assistant.usage.head.state")}
        </Text>
      </div>

      <ul className={card.rows} aria-label={t("assistant.usage")}>
        {rows.map((row) => (
          <UsageItem
            key={`${row.provider_id}/${row.model}`}
            row={row}
            now={now}
            number={number}
            time={time}
            onLimits={() => {
              onLimits(row);
            }}
          />
        ))}
      </ul>

      <div className={styles.foot}>
        {rows.length === 0 && (
          <Text size="sm" tone="muted" truncate>
            {t("assistant.usage.empty", { days: String(days) })}
          </Text>
        )}

        <UsageChart />
      </div>
    </details>
  );
}
