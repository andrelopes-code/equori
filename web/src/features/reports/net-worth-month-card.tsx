import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Grid } from "@slotted/react/grid";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { netWorthDaysQuery } from "@/features/reports/api";
import { ExpenseTable } from "@/features/reports/expense-table";
import { NetWorthDayChart } from "@/features/reports/net-worth-day-chart";
import { monthExpenses, monthRange } from "@/features/reports/net-worth-days";
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
  const { from, to } = monthRange(month, useToday());
  const days = useQuery(netWorthDaysQuery(api, from, to, valueIn));
  const transactions = useQuery(periodTransactionsQuery(api, from, to));
  const accounts = useQuery(accountsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency ?? "";

  const [day, setDay] = useState<string>();

  const title = t("report.netWorth.monthTitle", {
    month: formatMonthTitle(month, tag),
  });
  const categories = new Map(
    (accounts.data ?? [])
      .filter((account) => account.class === "expense")
      .map((account) => [account.id, account.name]),
  );
  const shownDay = day?.startsWith(month) === true ? day : undefined;
  const rows = monthExpenses(
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
            currency={valueIn}
            digits={digits(valueIn)}
            loading={days.data === undefined || scale === null}
            onDay={setDay}
          />
          <ExpenseTable
            rows={rows}
            day={shownDay}
            currency={base}
            digits={digits(base)}
          />
        </Grid>
      </CardBody>
    </Card>
  );
}
