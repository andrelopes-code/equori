import { ProgressBar } from "@slotted/react/progress-indicator";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { categoryTotalsQuery, useCategoryEntries } from "@/features/categories";
import { monthEnd } from "@/features/planning/agenda";
import {
  budgetProgressQuery,
  budgetsQuery,
  committedQuery,
} from "@/features/planning/api";
import {
  budgetGroups,
  startsBy,
  unbudgeted,
} from "@/features/planning/budget-month";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { QueryError } from "@/ui/query-error";

type Money = components["schemas"]["Money"];
type Progress = components["schemas"]["BudgetProgress"];
type Price = components["schemas"]["Price"];

// Spent as a share of planned plus carried; nothing left to spend reads as full.
function used(p: Pick<Progress, "planned" | "carried" | "spent">): number {
  const room = p.planned.amount + p.carried.amount;
  if (room <= 0) return p.spent.amount > 0 ? 100 : 0;
  return Math.round((p.spent.amount * 100) / room);
}

// The budgets of a month by category, what the month already commits, and the spending no
// budget covers.
export function BudgetsTab({ month }: { month: string }) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const budgets = useQuery(budgetsQuery(api));
  const accounts = useQuery(accountsQuery(api));
  const entries = useCategoryEntries(accounts.data);
  const committed = useQuery(committedQuery(api, month));
  const totals = useQuery(
    categoryTotalsQuery(api, `${month}-01`, monthEnd(month), "expense"),
  );
  const shown = (budgets.data ?? []).filter((b) => startsBy(b, month));
  const progress = useQueries({
    queries: shown.map((b) => budgetProgressQuery(api, b.id, month)),
  });
  const byBudget = new Map(
    progress.flatMap((p, i) => {
      const id = shown[i]?.id;
      return p.data === undefined || id === undefined ? [] : [[id, p.data]];
    }),
  );
  const failed = [budgets, totals, ...progress].find((q) => q.isError);
  if (failed?.error)
    return (
      <QueryError error={failed.error} onRetry={() => void failed.refetch()} />
    );
  const pending =
    budgets.isPending ||
    accounts.isPending ||
    progress.some((p) => p.isPending) ||
    scale === null;
  const groups = budgetGroups(entries, shown, byBudget);
  const loose = unbudgeted(entries, budgets.data ?? [], totals.data ?? []);
  const money = (m: Money) =>
    scale === null ? "" : fmt.money(m, scale(m.currency));
  const figure = (m: Money | undefined) =>
    m === undefined || scale === null ? undefined : money(m);
  const rate = (p: Price) =>
    t("budget.price", {
      instrument: p.instrument,
      rate: new Intl.NumberFormat(locale, {
        minimumFractionDigits: p.value.split(".")[1]?.length ?? 0,
      }).format(Number(p.value)),
      quote: p.quote_instrument,
      date: formatDate(p.date, locale),
    });
  const prices = committed.data?.prices ?? [];
  const figures = (
    p: Pick<Progress, "planned" | "carried" | "spent" | "available">,
  ) => (
    <>
      <TableCell numeric>{money(p.planned)}</TableCell>
      <TableCell numeric>{money(p.carried)}</TableCell>
      <TableCell numeric>{money(p.spent)}</TableCell>
      <TableCell numeric>{money(p.available)}</TableCell>
    </>
  );
  return (
    <Stack gap={6}>
      <FigureGrid label={t("budget.committed")}>
        <FigureCard
          label={t("budget.installments")}
          value={figure(committed.data?.installments)}
          note={t("budget.installmentsNote")}
          loading={committed.isPending}
        />
        <FigureCard
          label={t("budget.occurrences")}
          value={figure(committed.data?.occurrences)}
          note={
            prices.length === 0
              ? t("budget.occurrencesNote")
              : prices.map(rate).join("; ")
          }
          loading={committed.isPending}
        />
        <FigureCard
          label={t("budget.committedTotal")}
          value={figure(committed.data?.total)}
          note={t("budget.committedNote")}
          loading={committed.isPending}
        />
      </FigureGrid>
      <Table
        columns={6}
        variant="framed"
        loading={budgets.isFetching && !budgets.isPending}
      >
        <TableContent>
          <TableCaption>{t("budget.caption")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("budget.category")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("budget.planned")}
              </TableColumnHeader>
              <TableColumnHeader numeric>
                {t("budget.carried")}
              </TableColumnHeader>
              <TableColumnHeader numeric>{t("budget.spent")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("budget.available")}
              </TableColumnHeader>
              <TableColumnHeader>{t("budget.used")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {pending ? (
            <TableLoader skeletonRows={4} />
          ) : (
            <TableBody>
              {groups.length === 0 && (
                <TableEmpty>{t("budget.empty")}</TableEmpty>
              )}
              {groups.map((group) => (
                <Fragment key={group.root.id}>
                  {/* A lone budget on the top category names the group itself. */}
                  {(group.rows.length > 1 ||
                    group.rows[0]?.entry !== group.root) && (
                    <TableGroupRow>{group.root.name}</TableGroupRow>
                  )}
                  {group.rows.map((row) => {
                    const over = row.progress.available.amount < 0;
                    return (
                      <TableRow key={row.budget.id} value={row.budget.id}>
                        <TableRowHeader text="truncate">
                          <Link
                            to="/planning/budgets/$id"
                            params={{ id: row.budget.id }}
                            search={{ month }}
                          >
                            {row.label}
                          </Link>
                        </TableRowHeader>
                        {figures(row.progress)}
                        <TableCell>
                          <ProgressBar
                            size="sm"
                            hideLabel
                            showValue
                            label={t("budget.meter", { name: row.label })}
                            value={used(row.progress)}
                            tone={over ? "danger" : "accent"}
                            {...(over
                              ? { valueText: t("budget.overspent") }
                              : {})}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {group.subtotal !== undefined && (
                    <TableRow>
                      <TableRowHeader>
                        {t("budget.subtotal", { name: group.root.name })}
                      </TableRowHeader>
                      {figures(group.subtotal)}
                      <TableCell />
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
      <Table
        columns={2}
        variant="framed"
        // A long category path truncates instead of pushing the amount out of a phone's width.
        layout="fixed"
        loading={totals.isFetching && !totals.isPending}
      >
        <TableContent>
          <TableCaption>{t("budget.unbudgeted")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("budget.category")}</TableColumnHeader>
              <TableColumnHeader numeric>{t("budget.spent")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {totals.isPending || pending ? (
            <TableLoader skeletonRows={2} />
          ) : (
            <TableBody>
              {loose.length === 0 && (
                <TableEmpty>{t("budget.unbudgetedEmpty")}</TableEmpty>
              )}
              {loose.map(({ entry, total }) => (
                <TableRow key={entry.id} value={entry.id}>
                  <TableRowHeader text="truncate">{entry.path}</TableRowHeader>
                  <TableCell numeric>{money(total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
