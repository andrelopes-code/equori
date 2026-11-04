import { List, ListEmpty } from "@slotted/react/list";
import { useMemo } from "react";

import type { UsageRow } from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { UsageItem } from "@/features/setup/usage-item";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface UsageListProps {
  rows: readonly UsageRow[];
  now: Date;
  onLimits: (row: UsageRow) => void;
}

// The "Usage" group of the assistant section: today's and the period's figures per provider
// and model, against the declared limits (ADR 019 U7).
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
    <SettingsGroup
      title={t("assistant.usage")}
      description={t("assistant.usage.description")}
    >
      <List variant="ruled" aria-label={t("assistant.usage")}>
        {rows.length === 0 && (
          <ListEmpty>
            {t("assistant.usage.empty", { days: String(days) })}
          </ListEmpty>
        )}
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
      </List>
    </SettingsGroup>
  );
}
