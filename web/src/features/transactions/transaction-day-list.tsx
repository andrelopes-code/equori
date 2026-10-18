import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { PlaceholderRows } from "@/features/transactions/placeholder-rows";
import { RowCategory } from "@/features/transactions/row-category";
import type { TransactionRow } from "@/features/transactions/transaction-row";
import styles from "@/features/transactions/transaction-list.module.css";
import { formatDayHeader, formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { AmountLine } from "@/ui/amount-line";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

const placeholderRows = 5;
const separator = " \u00b7 ";

// The API returns newest first, so equal dates are adjacent, across page boundaries too.
function groupByDate(
  rows: TransactionRow[],
): { date: string; items: TransactionRow[] }[] {
  const days: { date: string; items: TransactionRow[] }[] = [];
  for (const row of rows) {
    const last = days.at(-1);
    if (last?.date === row.date) last.items.push(row);
    else days.push({ date: row.date, items: [row] });
  }
  return days;
}

// Ledger sheet L16: below 1024 px, the description and the amount on one line,
// then category · account · tags; a grouped list heads each day.
export function TransactionDayList({
  rows,
  grouped,
  scale,
  loadingMore,
}: {
  rows: TransactionRow[];
  grouped: boolean;
  scale: (currency: string) => number;
  loadingMore: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const spaLink = useSpaLink();
  const words = { today: t("date.today"), yesterday: t("date.yesterday") };
  const renderRow = (row: TransactionRow) => {
    const title = row.title === "" ? t("transactions.untitled") : row.title;
    const category =
      row.transfer || row.uncategorized || row.category !== "" ? (
        <RowCategory row={row} />
      ) : null;
    const parts: ReactNode[] = [
      ...(grouped ? [] : [formatDayMonth(row.date, locale)]),
      ...(category === null ? [] : [category]),
      ...[row.accounts, ...row.tags].filter((part) => part !== ""),
    ];
    return (
      <ListItem key={row.id}>
        <ListItemLink {...spaLink(`/transactions/${row.id}`)}>
          <ListItemBody>
            <ListItemLabel>
              <AmountLine
                own="transaction-line"
                fullTitle={title}
                title={
                  <span className={row.voided ? styles.voided : undefined}>
                    {title}
                  </span>
                }
                amount={
                  <MoneyText
                    money={row.money}
                    scale={scale(row.money.currency)}
                  />
                }
              />
            </ListItemLabel>
            <ListItemDescription>
              {parts.map((part, i) => (
                <Fragment key={String(i)}>
                  {i > 0 && separator}
                  {part}
                </Fragment>
              ))}
            </ListItemDescription>
          </ListItemBody>
        </ListItemLink>
      </ListItem>
    );
  };
  return (
    <List
      variant="ruled"
      aria-label={t("transactions.list")}
      loading={loadingMore}
    >
      {grouped
        ? groupByDate(rows).map(({ date, items }) => (
            <ListSection
              key={date}
              label={formatDayHeader(date, today, locale, words)}
              level="2"
              sticky
            >
              {items.map(renderRow)}
            </ListSection>
          ))
        : rows.map(renderRow)}
      {loadingMore && <PlaceholderRows count={placeholderRows} />}
    </List>
  );
}
