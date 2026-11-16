import { Text } from "@slotted/react/typography";

import type { UsageRow } from "@/features/setup/api";
import card from "@/features/setup/assistant/assistant-card.module.css";
import styles from "@/features/setup/usage/usage-details.module.css";
import { usageSummary } from "@/features/setup/usage/usage-summary";
import type { numberFormatter } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";

interface UsageSummaryLineProps {
  rows: readonly UsageRow[];
  now: Date;
  number: ReturnType<typeof numberFormatter>;
}

// What the closed usage card states (spec A8): today's requests, then the models that rest and
// the models near a limit, each only when there is one.
export function UsageSummaryLine({ rows, now, number }: UsageSummaryLineProps) {
  const t = useT();

  const summary = usageSummary(rows, now);

  return (
    <span className={styles.figures}>
      <Text size="sm" tone="muted" numeric="tabular" className={card.desk}>
        {t("assistant.usage.summary.requests", {
          count: number.format(summary.requests),
        })}
      </Text>
      {summary.resting > 0 && (
        <Text size="sm" tone="danger" numeric="tabular">
          {t("assistant.usage.summary.resting", {
            count: number.format(summary.resting),
          })}
        </Text>
      )}
      {summary.near > 0 && (
        <Text size="sm" tone="warning" numeric="tabular">
          {t("assistant.usage.summary.near", {
            count: number.format(summary.near),
          })}
        </Text>
      )}
    </span>
  );
}
