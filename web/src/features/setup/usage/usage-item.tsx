import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { UsageRow } from "@/features/setup/api";
import card from "@/features/setup/assistant/assistant-card.module.css";
import styles from "@/features/setup/usage/usage-details.module.css";
import { UsageGauge } from "@/features/setup/usage/usage-gauge";
import { usageStatus } from "@/features/setup/usage/usage-rows";
import type { numberFormatter } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";

interface UsageItemProps {
  row: UsageRow;
  now: Date;
  number: ReturnType<typeof numberFormatter>;
  time: Intl.DateTimeFormat;
  onLimits: () => void;
}

const tones = {
  reached: "danger",
  cooling: "danger",
  near: "warning",
} as const;

// The usage of one provider and model (spec A8): the model over its provider and today's errors,
// today's requests and tokens against each declared limit, the state in words and the limits.
export function UsageItem({
  row,
  now,
  number,
  time,
  onLimits,
}: UsageItemProps) {
  const t = useT();

  const status = usageStatus(row, now);
  const limited =
    row.requests_per_day !== undefined || row.tokens_per_day !== undefined;
  const provider =
    row.today_errors > 0
      ? `${row.provider_name} · ${t("assistant.usage.errors", {
          count: number.format(row.today_errors),
        })}`
      : row.provider_name;
  const state = stateText();

  function stateText() {
    if (status === "cooling" && row.cooling_until !== undefined)
      return t("assistant.usage.cooling", {
        time: time.format(new Date(row.cooling_until)),
      });

    if (status === "reached") return t("assistant.usage.reached");

    if (status === "near") return t("assistant.usage.near");

    return t(limited ? "assistant.usage.within" : "assistant.usage.unlimited");
  }

  return (
    <li className={[card.row, styles.row].join(" ")}>
      <div className={card.cell}>
        <Text size="sm" truncate className={card.mono}>
          {row.model}
        </Text>
        <Text size="sm" tone="muted" truncate className={card.desk}>
          {provider}
        </Text>
      </div>

      <UsageGauge
        label={t("assistant.usage.meter.requests")}
        used={row.today_requests}
        limit={row.requests_per_day}
        number={number}
        className={styles.requests}
      />

      <UsageGauge
        label={t("assistant.usage.meter.tokens")}
        used={row.today_tokens}
        limit={row.tokens_per_day}
        number={number}
        className={card.desk}
      />

      <Text
        size="sm"
        tone={status === null ? "muted" : tones[status]}
        truncate
        className={styles.state}
      >
        {state}
      </Text>

      <Button
        variant="ghost"
        tone="secondary"
        className={card.desk}
        onClick={onLimits}
      >
        {t("assistant.usage.limits")}
      </Button>
    </li>
  );
}
