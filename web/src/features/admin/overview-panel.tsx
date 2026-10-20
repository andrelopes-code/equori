import { useQueries, useQuery } from "@tanstack/react-query";
import { Grid } from "@slotted/react/grid";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { adminQuery, allPagesQuery } from "@/features/admin/api";
import { cellText } from "@/features/admin/cell-text";
import { DateEditor } from "@/features/admin/date-editor";
import { FigureTile } from "@/features/admin/figure-tile";
import { monthBounds } from "@/features/admin/month-bounds";
import { MonthSelect } from "@/features/admin/month-select";
import {
  balanceTotals,
  monthFlows,
  statementMonths,
} from "@/features/admin/overview-math";
import { RecordTable } from "@/features/admin/record-table";
import { StatementTile } from "@/features/admin/statement-tile";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useDisplay } from "@/features/admin/use-display";
import { useT } from "@/i18n/i18n-provider";

type BalanceList = components["schemas"]["BalanceList"];
type Transaction = components["schemas"]["Transaction"];
type Statement = components["schemas"]["StatementSummary"];
type Committed = components["schemas"]["Committed"];

const statementColumns = [
  "reference",
  "account_id",
  "closing_date",
  "due_date",
  "status",
  "opening",
  "charges",
  "credits",
  "amount_due",
  "payments",
  "unpaid",
  "reconciled",
] as const;

// Figures to compare with the institutions' own: balances on a date, a month's flows,
// card statements by reference month, and the month's commitments.
export function OverviewPanel({ ctx }: { ctx: AdminContext }) {
  const t = useT();
  const api = useApi();
  const show = useDisplay();
  const [date, setDate] = useState(ctx.refs.today);
  const [month, setMonth] = useState(ctx.refs.month);
  const money = (amount: number, currency: string) =>
    cellText({ amount, currency }, ctx.cells);
  const classOf = useMemo(
    () => new Map(ctx.accounts.map((a) => [a.id, a.class])),
    [ctx.accounts],
  );
  const cards = ctx.accounts.filter((a) => a.kind === "credit_card");

  const booked = useQuery(
    adminQuery(api, "/balances", { date, basis: "booked" }),
  );
  const settled = useQuery(
    adminQuery(api, "/balances", { date, basis: "settled" }),
  );
  const transactions = useQuery(
    allPagesQuery(api, "/transactions", monthBounds(month)),
  );
  const statements = useQueries({
    queries: cards.map((card) =>
      allPagesQuery(api, `/accounts/${card.id}/statements`),
    ),
    combine: (results) => ({
      items: results.flatMap((r) => (r.data ?? []) as Statement[]),
      pending: results.some((r) => r.isPending),
    }),
  });
  const committed = useQuery(adminQuery(api, "/commitments", { month }));

  const bookedTotals = balanceTotals(
    (booked.data as BalanceList | undefined)?.items ?? [],
    classOf,
  );
  const settledTotals = balanceTotals(
    (settled.data as BalanceList | undefined)?.items ?? [],
    classOf,
  );
  const flows = monthFlows((transactions.data ?? []) as Transaction[], classOf);
  const months = statementMonths(statements.items);
  const thisMonth = months.filter((row) => row.reference === month);
  const commitments = committed.data as Committed | undefined;
  const statementRows = [...statements.items].sort(
    (a, b) =>
      b.reference.localeCompare(a.reference) ||
      a.account_id.localeCompare(b.account_id),
  );

  return (
    <Stack gap={8}>
      <Grid gap={4} minItemWidth="sm">
        <DateEditor
          name="date"
          label={t("admin.date")}
          value={date}
          onChange={setDate}
        />
        <MonthSelect
          name="month"
          label={t("admin.month")}
          value={month}
          onChange={setMonth}
        />
      </Grid>

      <Grid gap={4} minItemWidth="sm">
        {booked.isPending ? (
          <FigureTile
            size="md"
            label={t("admin.headline.netWorth", { date: show.date(date) })}
            value={undefined}
            loading
          />
        ) : (
          bookedTotals.map((total) => {
            const of = (amount: number) =>
              show.money({ amount, currency: total.currency });
            return (
              <FigureTile
                key={total.currency}
                size="md"
                label={t("admin.headline.netWorth", { date: show.date(date) })}
                value={of(total.net)}
                comparison={t("admin.headline.netWorthDetail", {
                  assets: of(total.asset),
                  liabilities: of(total.liability),
                })}
              />
            );
          })
        )}
        {cards.map((card) => (
          <StatementTile
            key={card.id}
            label={card.name}
            month={month}
            loading={statements.pending}
            statement={statements.items.find(
              (s) => s.account_id === card.id && s.reference === month,
            )}
          />
        ))}
      </Grid>

      <TitledSection title={t("admin.overview.balances", { date })}>
        <Grid gap={4} minItemWidth="sm">
          {bookedTotals.flatMap((total) => {
            const other = settledTotals.find(
              (s) => s.currency === total.currency,
            );
            const settledOf = (value: number | undefined) =>
              t("admin.overview.settled", {
                value: money(value ?? 0, total.currency),
              });
            return [
              <FigureTile
                key={`asset-${total.currency}`}
                label={t("admin.overview.assets")}
                value={money(total.asset, total.currency)}
                comparison={settledOf(other?.asset)}
              />,
              <FigureTile
                key={`liability-${total.currency}`}
                label={t("admin.overview.liabilities")}
                value={money(total.liability, total.currency)}
                comparison={settledOf(other?.liability)}
              />,
              <FigureTile
                key={`net-${total.currency}`}
                label={t("admin.overview.net")}
                value={money(total.net, total.currency)}
                comparison={settledOf(other?.net)}
              />,
            ];
          })}
        </Grid>
      </TitledSection>

      <TitledSection title={t("admin.overview.flows", { month })}>
        <Stack gap={5}>
          {transactions.data === undefined ? (
            <Text tone="muted">{t("admin.loading")}</Text>
          ) : (
            <Grid gap={4} minItemWidth="sm">
              {flows.totals.flatMap((total) => [
                <FigureTile
                  key={`income-${total.currency}`}
                  label={t("admin.overview.income")}
                  value={money(total.income, total.currency)}
                />,
                <FigureTile
                  key={`expense-${total.currency}`}
                  label={t("admin.overview.expense")}
                  value={money(total.expense, total.currency)}
                />,
                <FigureTile
                  key={`result-${total.currency}`}
                  label={t("admin.overview.result")}
                  value={money(total.result, total.currency)}
                />,
              ])}
            </Grid>
          )}
          <RecordTable
            caption={t("admin.overview.flowsTable", {
              count: String(transactions.data?.length ?? 0),
            })}
            rows={flows.accounts.map((row) => ({ ...row }))}
            cells={ctx.cells}
          />
        </Stack>
      </TitledSection>

      <TitledSection title={t("admin.overview.statements")}>
        <Stack gap={5}>
          <Grid gap={4} minItemWidth="sm">
            {thisMonth.flatMap((row) => [
              <FigureTile
                key={`due-${row.amount_due.currency}`}
                label={t("admin.overview.due", { month })}
                value={cellText(row.amount_due, ctx.cells)}
                comparison={t("admin.overview.statementCount", {
                  count: String(row.statements),
                })}
              />,
              <FigureTile
                key={`paid-${row.amount_due.currency}`}
                label={t("admin.overview.paid", { month })}
                value={cellText(row.payments, ctx.cells)}
              />,
              <FigureTile
                key={`unpaid-${row.amount_due.currency}`}
                label={t("admin.overview.unpaid", { month })}
                value={cellText(row.unpaid, ctx.cells)}
              />,
            ])}
          </Grid>
          <RecordTable
            caption={t("admin.overview.limits")}
            rows={cards.map((card) => ({
              account_id: card.id,
              credit_limit: card.card?.credit_limit,
              available_limit: card.card?.available_limit,
            }))}
            cells={ctx.cells}
          />
          <RecordTable
            caption={t("admin.overview.byMonth")}
            rows={months}
            cells={ctx.cells}
          />
          <RecordTable
            caption={t("admin.overview.byCard")}
            rows={statementRows}
            cells={ctx.cells}
            columns={statementColumns}
          />
        </Stack>
      </TitledSection>

      <TitledSection title={t("admin.overview.commitments", { month })}>
        {commitments === undefined ? (
          <Text tone="muted">{t("admin.loading")}</Text>
        ) : (
          <Grid gap={4} minItemWidth="sm">
            <FigureTile
              label={t("admin.overview.installments")}
              value={cellText(commitments.installments, ctx.cells)}
            />
            <FigureTile
              label={t("admin.overview.occurrences")}
              value={cellText(commitments.occurrences, ctx.cells)}
            />
            <FigureTile
              label={t("admin.overview.committed")}
              value={cellText(commitments.total, ctx.cells)}
            />
          </Grid>
        )}
      </TitledSection>
    </Stack>
  );
}
