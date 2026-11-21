import { List, ListSection } from "@slotted/react/list";
import type { ReactNode } from "react";
import { useMemo } from "react";

import type { CategoryEntry } from "@/features/categories";
import { dayLabel } from "@/features/transactions/model/day-label";
import type { TransactionList } from "@/features/transactions/transactions-grid/use-transaction-list";
import { groupByDay } from "@/features/transactions/transactions-statement/group-by-day";
import { StatementDayTotal } from "@/features/transactions/transactions-statement/statement-day-total";
import { StatementPlaceholder } from "@/features/transactions/transactions-statement/statement-placeholder";
import { StatementRow } from "@/features/transactions/transactions-statement/statement-row";
import styles from "@/features/transactions/transactions-statement/transactions-statement.module.css";
import { useLoadMore } from "@/features/transactions/transactions-statement/use-load-more";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

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
  const end = useLoadMore(list.hasMore && !list.pending, list.loadMore);

  const days = useMemo(() => groupByDay(list.rows), [list.rows]);
  const words = { today: t("day.today"), yesterday: t("day.yesterday") };

  function handleSelectedChange(id: string, selected: boolean) {
    onSelectionChange(
      selected ? [...selection, id] : selection.filter((key) => key !== id),
    );
  }

  if (list.pending) return <StatementPlaceholder />;

  if (list.rows.length === 0)
    return empty(list.error === null ? "empty" : "error");

  return (
    <div aria-busy={list.refreshing}>
      <List
        aria-label={t("nav.transactions")}
        variant="plain"
        className={styles.statement}
      >
        {days.map((day) => (
          <ListSection
            key={day.date}
            label={dayLabel(day.date, today, locale, words)}
            end={<StatementDayTotal rows={day.rows} scale={scale} />}
            sticky
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
          </ListSection>
        ))}
      </List>

      <div ref={end} />
    </div>
  );
}
