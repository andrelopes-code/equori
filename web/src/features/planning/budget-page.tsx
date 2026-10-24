import { ButtonLink } from "@slotted/react/button";
import { Chart } from "@slotted/react/chart";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { addMonths } from "@/features/cards";
import { useCategoryEntries } from "@/features/categories";
import { monthEnd } from "@/features/planning/agenda";
import { budgetProgressQuery, budgetQuery } from "@/features/planning/api";
import { BudgetAmountDialog } from "@/features/planning/budget-amount-dialog";
import { useScale } from "@/features/setup";
import { formatMonthName, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { HeaderAction } from "@/ui/header-action";
import { useAppLink } from "@/ui/use-app-link";
import { MonthControl } from "@/ui/month-control";
import { QueryError } from "@/ui/query-error";

// How many months the chart compares, ending at the month the page reads.
const chartMonths = 6;

// One budget: planned against spent over the last months, its amounts by month, and the
// transactions of its category in the month the page reads.
export function BudgetPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const navigate = useNavigate();
  const follow = useAppLink();
  const { id } = useParams({ from: "/_authed/planning/budgets/$id" });
  const search = useSearch({ from: "/_authed/planning/budgets/$id" });
  const month = search.month ?? today.slice(0, 7);
  const budget = useQuery(budgetQuery(api, id));
  const accounts = useQuery(accountsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const [adding, setAdding] = useState(false);
  const first = budget.data?.amounts[0]?.effective_from;
  const months = Array.from({ length: chartMonths }, (_, i) =>
    addMonths(month, i - chartMonths + 1),
  ).filter((m) => first !== undefined && m >= first);
  const progress = useQueries({
    queries: months.map((m) => budgetProgressQuery(api, id, m)),
  });
  if (budget.isError)
    return (
      <Page width="full">
        <PageBody>
          <QueryError
            error={budget.error}
            onRetry={() => void budget.refetch()}
          />
        </PageBody>
      </Page>
    );
  if (budget.data === undefined || scale === null)
    return (
      <Page width="full" loading>
        <PageBody>
          <SkeletonText lines={6} />
        </PageBody>
      </Page>
    );
  const b = budget.data;
  const transactions = {
    account_id: b.category_id,
    from: `${month}-01`,
    to: monthEnd(month),
  };
  const name =
    entries.find((e) => e.id === b.category_id)?.path ?? t("ledger.untitled");
  const currency = b.amounts[0]?.amount.currency ?? "";
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale(currency));
  const records = progress.flatMap((p) =>
    p.data === undefined
      ? []
      : [
          {
            label: formatMonthName(p.data.month, locale),
            planned: p.data.planned.amount,
            spent: p.data.spent.amount,
          },
        ],
  );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderNav>
            <PageHeaderBack
              render={(props) => (
                <Link
                  {...props}
                  to="/planning"
                  search={{ tab: "budgets", month }}
                />
              )}
            >
              {t("planning.tab.budgets")}
            </PageHeaderBack>
          </PageHeaderNav>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{name}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t(b.rollover ? "budget.withRollover" : "budget.noRollover")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <MonthControl
                label={t("budget.month")}
                value={month}
                onChange={(next) => {
                  void navigate({
                    to: "/planning/budgets/$id",
                    params: { id },
                    search: { month: next },
                    replace: true,
                  });
                }}
              />
              {/* Workaround for Slotted finding "ButtonLink render props cannot be spread onto a router link": the anchor keeps its href, a plain click navigates inside the application. */}
              <ButtonLink
                variant="outline"
                tone="secondary"
                href={`/transactions?${new URLSearchParams(transactions).toString()}`}
                onClick={follow({ to: "/transactions", search: transactions })}
              >
                {t("budget.transactions", {
                  month: formatMonthTitle(month, locale),
                })}
              </ButtonLink>
              <HeaderAction
                primary
                label={t("budget.addAmount")}
                glyph="plus"
                onClick={() => {
                  setAdding(true);
                }}
              />
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          <Chart
            size="sm"
            loading={progress.some((p) => p.isPending)}
            data={records}
            series={[
              {
                id: "planned",
                kind: "bar",
                field: "planned",
                label: t("budget.planned"),
                tone: "neutral",
                format: (value) => money(value),
              },
              {
                id: "spent",
                kind: "bar",
                field: "spent",
                label: t("budget.spent"),
                format: (value) => money(value),
              },
            ]}
            title={t("budget.chart")}
            x={{ field: "label" }}
            y={{ format: (value) => money(value) }}
          />
          <Table columns={2} variant="framed">
            <TableContent>
              <TableCaption>{t("budget.amounts")}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>{t("budget.from")}</TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("budget.amount")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {b.amounts.map((a) => (
                  <TableRow key={a.effective_from} value={a.effective_from}>
                    <TableRowHeader>
                      {formatMonthTitle(a.effective_from, locale)}
                    </TableRowHeader>
                    <TableCell numeric>
                      {fmt.money(a.amount, scale(a.amount.currency))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContent>
          </Table>
        </Stack>
      </PageBody>
      {adding && (
        <BudgetAmountDialog
          budget={b}
          onDone={() => {
            setAdding(false);
          }}
          onCancel={() => {
            setAdding(false);
          }}
        />
      )}
    </Page>
  );
}
