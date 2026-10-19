import { Fragment } from "react";

import { TransactionTableBand } from "@/features/transactions/transaction-table-band";
import { groupByDay } from "@/features/transactions/transaction-table-days";
import { TransactionTablePlaceholders } from "@/features/transactions/transaction-table-placeholders";
import { TransactionTableRow } from "@/features/transactions/transaction-table-row";
import { TransactionTableScheduled } from "@/features/transactions/transaction-table-scheduled";
import { TransactionTableToday } from "@/features/transactions/transaction-table-today";
import styles from "@/features/transactions/transaction-table.module.css";
import type { TransactionRow } from "@/features/transactions/transaction-row";
import type { UpcomingRow } from "@/features/transactions/upcoming-row";
import { formatDayHeader, formatSigned } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Families read: table, link, skeleton. The ledger of transactions needs band rows that span
// the columns, a row that selects on a click, and hover and selection tints, none of which the
// table family draws without targeting its parts (O5), so the table is an element of the app's
// own with the family's rules: ruled rows, muted heads. The description link keeps the link
// family's focus ring. Hover and selection are tints without motion. Under forced colors the
// selection rule becomes a border in the system text colour.
// Ledger sheet L15: Description, Account, Category and Amount; "brief" drops Category.
export function TransactionTable({
  rows,
  brief,
  baseCurrency,
  scale,
  loading,
  loadingMore,
  onSelect,
  selected,
  upcoming = [],
}: {
  rows: TransactionRow[];
  brief: boolean;
  baseCurrency: string | undefined;
  scale: (currency: string) => number;
  loading: boolean;
  loadingMore: boolean;
  onSelect?: (id: string) => void;
  selected?: string;
  upcoming?: UpcomingRow[];
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const words = { today: t("date.today"), yesterday: t("date.yesterday") };
  const columns = brief ? 3 : 4;
  const money = (m: { amount: number; currency: string }) =>
    formatSigned(m, scale(m.currency), locale, {
      symbol: m.currency !== baseCurrency,
    });
  const net = (amount: number | undefined) =>
    amount === undefined || baseCurrency === undefined
      ? ""
      : formatSigned(
          { amount, currency: baseCurrency },
          scale(baseCurrency),
          locale,
          { symbol: false },
        );
  const band = (date: string, amount: number | undefined) => (
    <TransactionTableBand
      date={date}
      label={formatDayHeader(date, today, locale, words)}
      net={net(amount)}
      columns={columns}
    />
  );
  return (
    <table className={styles.table} aria-label={t("transactions.list")}>
      <colgroup>
        <col />
        <col className={styles.colAccount} />
        {!brief && <col className={styles.colCategory} />}
        <col className={styles.colAmount} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{t("transactions.column.description")}</th>
          <th scope="col">{t("transactions.column.account")}</th>
          {!brief && <th scope="col">{t("transactions.column.category")}</th>}
          <th scope="col" data-numeric="">
            {t("transactions.column.amount")}
          </th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <TransactionTablePlaceholders columns={columns} />
        ) : (
          <>
            {groupByDay(upcoming, baseCurrency).map((day) => (
              <Fragment key={day.date}>
                {band(day.date, day.net)}
                {day.items.map((row) => (
                  <TransactionTableScheduled
                    key={row.id}
                    row={row}
                    amount={money(row.money)}
                    brief={brief}
                  />
                ))}
              </Fragment>
            ))}
            {upcoming.length > 0 && <TransactionTableToday columns={columns} />}
            {groupByDay(
              rows,
              baseCurrency,
              (row) => !row.voided && !row.transfer,
            ).map((day) => (
              <Fragment key={day.date}>
                {band(day.date, day.net)}
                {day.items.map((row) => (
                  <TransactionTableRow
                    key={row.id}
                    row={row}
                    amount={money(row.money)}
                    brief={brief}
                    selected={row.id === selected}
                    onSelect={onSelect}
                  />
                ))}
              </Fragment>
            ))}
          </>
        )}
        {loadingMore && <TransactionTablePlaceholders columns={columns} />}
      </tbody>
    </table>
  );
}
