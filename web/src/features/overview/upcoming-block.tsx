import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { OverviewBlock } from "@/features/overview/overview-block";
import { OverviewRows } from "@/features/overview/overview-rows";
import { upcomingDays, upcomingWindow } from "@/features/overview/upcoming";
import { useBase } from "@/features/overview/use-base";
import {
  OccurrenceActions,
  occurrencesQuery,
  schedulesQuery,
} from "@/features/planning";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyFigure } from "@/ui/money-figure";

// The read reaches 180 days back for overdue occurrences; the contract allows 366 days.
const lookBackDays = 180;

export function UpcomingBlock() {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const today = useToday();
  const { scale } = useBase();
  const occurrences = useQuery(
    occurrencesQuery(
      api,
      shiftDate(today, -lookBackDays),
      shiftDate(today, upcomingDays),
    ),
  );
  const schedules = useQuery(schedulesQuery(api));
  const error = occurrences.error ?? schedules.error;
  const loading =
    occurrences.data === undefined ||
    schedules.data === undefined ||
    scale === null;
  const rows =
    loading || error !== null
      ? []
      : upcomingWindow(occurrences.data, today).map((occurrence) => {
          const name =
            schedules.data.find((s) => s.id === occurrence.schedule_id)
              ?.description ?? t("ledger.untitled");
          const date = formatDate(occurrence.expected_on, locale);
          return {
            key: occurrence.id,
            title: name,
            line:
              occurrence.state === "overdue"
                ? t("overview.upcoming.overdue", { date })
                : date,
            end: (
              <MoneyFigure
                amount={occurrence.expected_amount.amount}
                currency={occurrence.expected_amount.currency}
                scale={scale(occurrence.expected_amount.currency)}
              />
            ),
            actions: <OccurrenceActions occurrence={occurrence} name={name} />,
          };
        });
  return (
    <OverviewBlock
      title={t("overview.upcoming.title")}
      link={{
        label: t("overview.upcoming.open"),
        options: { to: "/planning" },
      }}
      loading={loading && error === null}
      error={error}
      onRetry={() => {
        if (occurrences.isError) void occurrences.refetch();
        if (schedules.isError) void schedules.refetch();
      }}
      empty={rows.length === 0 ? t("overview.upcoming.empty") : undefined}
    >
      <OverviewRows label={t("overview.upcoming.title")} rows={rows} />
    </OverviewBlock>
  );
}
