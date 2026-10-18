import { useQuery } from "@tanstack/react-query";
import { Text } from "@slotted/react/typography";

import { useApi } from "@/api/api-context";
import { connectionsQuery } from "@/features/connections/api";
import { formatDayMonth, todayISO } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

export function SyncStatus() {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const { data } = useQuery(connectionsQuery(useApi()));
  const latest = (data?.items ?? [])
    .flatMap((c) => (c.last_synced_at === undefined ? [] : [c.last_synced_at]))
    .reduce<Date | undefined>((max, at) => {
      const date = new Date(at);
      return max === undefined || date > max ? date : max;
    }, undefined);
  if (latest === undefined) return null;
  const day = todayISO(latest);
  const time =
    day === today
      ? new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(latest)
      : formatDayMonth(day, locale);
  return (
    <Text size="sm" tone="muted">
      {t("sync.updated", { time })}
    </Text>
  );
}
