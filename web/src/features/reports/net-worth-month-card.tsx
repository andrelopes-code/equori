import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { netWorthDaysQuery } from "@/features/reports/api";
import { EntryTable } from "@/features/reports/entry-table";
import { EntryTotals } from "@/features/reports/entry-totals";
import { NetWorthDayChart } from "@/features/reports/net-worth-day-chart";
import { monthEntries, monthRange } from "@/features/reports/net-worth-days";
import { useNetWorthForecast } from "@/features/reports/use-net-worth-forecast";
import { settingsQuery, useScale } from "@/features/setup";
import { periodTransactionsQuery } from "@/features/transactions";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MonthControl } from "@/ui/month-control";

interface NetWorthMonthCardProps {
  month: string;
  valueIn: string;
  onMonth: (month: string) => void;
}

// Net worth at the end of each day of a month, beside the month's expenses: a card purchase
// lowers net worth on its day and stands in the table on that day (net worth days design, D3 to D5).
export function NetWorthMonthCard({
  month,
  valueIn,
  onMonth,
}: NetWorthMonthCardProps) {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const scale = useScale();
  const today = useToday();
  const { from, to } = monthRange(month, today);
  const days = useQuery(netWorthDaysQuery(api, from, to, valueIn));
  const transactions = useQuery(periodTransactionsQuery(api, from, to));
  const accounts = useQuery(accountsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency ?? "";

  const forecast = useNetWorthForecast(
    month,
    valueIn,
    days.data?.find((d) => d.date === today)?.net.amount,
  );

  const [day, setDay] = useState<string>();

  const title = t("report.netWorth.monthTitle", {
    month: formatMonthTitle(month, tag),
  });
  const categories = new Map(
    (accounts.data ?? []).flatMap((account) =>
      account.class === "income" || account.class === "expense"
        ? [[account.id, { name: account.name, kind: account.class }] as const]
        : [],
    ),
  );
  const shownDay = day?.startsWith(month) === true ? day : undefined;
  const rows = monthEntries(
    transactions.data ?? [],
    categories,
    base,
    shownDay,
  );
  const digits = (currency: string) =>
    scale === null || currency === "" ? 0 : scale(currency);

  return (
    <Card>
      <CardHeader>
        <Heading level={3} size="md">
          {title}
        </Heading>
        <Text size="sm" tone="muted">
          {t("report.netWorth.monthNote")}
        </Text>
        {forecast !== undefined && (
          <Text size="sm" tone="muted">
            {t(noteKey(forecast.history), { count: forecast.history })}
          </Text>
        )}
        <CardActions>
          <MonthControl
            value={month}
            onChange={onMonth}
            label={t("report.netWorth.monthPick")}
          />
        </CardActions>
      </CardHeader>

      <CardBody>
        <Grid columns={2} gap={4} minItemWidth="lg">
          <NetWorthDayChart
            title={title}
            days={days.data ?? []}
            forecast={forecast}
            currency={valueIn}
            digits={digits(valueIn)}
            loading={days.data === undefined || scale === null}
            onDay={setDay}
          />
          <Stack gap={4}>
            <EntryTotals rows={rows} currency={base} digits={digits(base)} />

            <EntryTable
              rows={rows}
              day={shownDay}
              currency={base}
              digits={digits(base)}
            />
          </Stack>
        </Grid>
      </CardBody>
    </Card>
  );
}

// The sources of the forecast in words, by the count of history months (F10).
function noteKey(count: number) {
  if (count === 0) return "report.netWorth.forecastNoteNone";

  if (count === 1) return "report.netWorth.forecastNoteOne";

  return "report.netWorth.forecastNote";
}
