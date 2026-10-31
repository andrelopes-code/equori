import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { SyncRecordsTable } from "@/features/accounts/sync-records-table";
import { syncCounts } from "@/features/accounts/sync-counts";
import { formatInstant } from "@/features/accounts/instant";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type SyncRun = components["schemas"]["SyncRun"];

interface SyncRunSummaryProps {
  run: SyncRun;
  accounts: Map<string, Account>;
}

export function SyncRunSummary({ run, accounts }: SyncRunSummaryProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const time = formatInstant(run.started_at, locale);
  const list = new Intl.ListFormat(locale, { style: "short", type: "unit" });

  return (
    <Stack gap={1}>
      <Text size="sm">{t("links.syncAt", { time })}</Text>
      {run.batches.map((batch) => {
        const account = accounts.get(batch.account_id)?.name ?? "";
        const counts = syncCounts(batch.counts);

        return (
          <Text size="sm" key={batch.id}>
            {counts.length === 0
              ? t("links.syncNoChange", { account })
              : t("links.syncCounts", {
                  account,
                  counts: list.format(
                    counts.map(({ key, count }) =>
                      t(`links.count.${key}`, { count }),
                    ),
                  ),
                })}
          </Text>
        );
      })}
      {run.records.length > 0 && (
        <SyncRecordsTable
          records={run.records}
          label={t("links.syncRecords", { time })}
        />
      )}
    </Stack>
  );
}
