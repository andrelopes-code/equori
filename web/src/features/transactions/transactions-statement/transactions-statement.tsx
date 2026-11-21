import type { ReactNode } from "react";
import { useMemo } from "react";

import type { CategoryEntry } from "@/features/categories";
import { dayLabel } from "@/features/transactions/model/day-label";
import type { TransactionList } from "@/features/transactions/transactions-grid/use-transaction-list";
import { groupByDay } from "@/ui/statement/group-by-day";
import { periodTotals } from "@/features/transactions/model/period-totals";
import { StatementRow } from "@/features/transactions/transactions-statement/statement-row";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import type { ListRow } from "@/features/transactions/transactions-grid/use-transaction-list";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useLoadMore } from "@/ui/runtime/use-load-more";
import { StatementDay } from "@/ui/statement/statement-day";
import { StatementList } from "@/ui/statement/statement-list";
import { StatementPlaceholder } from "@/ui/statement/statement-placeholder";

interface TransactionsStatementProps {
  list: TransactionList;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
  onOpen: (id: string) => void;
  empty: (status: "empty" | "error") => ReactNode;
  selecting: boolean;
  selection: readonly string[];
  onSelectionChange: (ids: readonly string[]) => void;
}

// The phone form of the transaction list: a statement of days (spec
// 2026-11-21-mobile-statement, MS2 to MS10). The page scrolls; the list is as tall as its rows.
export function TransactionsStatement({
  list,
  categories,
  scale,
  onOpen,
  empty,
  selecting,
  selection,
  onSelectionChange,
}: TransactionsStatementProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  const end = useLoadMore(list.hasMore && !list.pending, list.loadMore);

  const days = useMemo(() => groupByDay(list.rows), [list.rows]);
  const words = { today: t("day.today"), yesterday: t("day.yesterday") };

  function handleSelectedChange(id: string, selected: boolean) {
    onSelectionChange(
      selected ? [...selection, id] : selection.filter((key) => key !== id),
    );
  }

  // What the day changed: money in less money out of its loaded rows, transfers and voided rows
  // left out; nothing for a day of more than one currency (spec MS3).
  function dayTotal(rows: readonly ListRow[]) {
    const totals = periodTotals(rows);
    if (totals === null) return undefined;

    const money = {
      amount: totals.income + totals.expense,
      currency: totals.currency,
    };

    return fmt.signed(money, scale(totals.currency));
  }

  if (list.pending)
    return <StatementPlaceholder label={t("nav.transactions")} />;

  if (list.rows.length === 0)
    return empty(list.error === null ? "empty" : "error");

  return (
    <div>
      <StatementList label={t("nav.transactions")} busy={list.refreshing}>
        {days.map((day) => (
          <StatementDay
            key={day.date}
            label={dayLabel(day.date, today, locale, words)}
            end={dayTotal(day.rows)}
          >
            {day.rows.map((row) => (
              <StatementRow
                key={row.id}
                row={row}
                categories={categories}
                scale={scale}
                onOpen={onOpen}
                selecting={selecting}
                selected={selection.includes(row.id)}
                onSelectedChange={handleSelectedChange}
              />
            ))}
          </StatementDay>
        ))}
      </StatementList>

      <div ref={end} />
    </div>
  );
}
