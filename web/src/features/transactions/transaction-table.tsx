import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import { Link } from "@slotted/react/link";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import { RowCategory } from "@/features/transactions/row-category";
import type { TransactionRow } from "@/features/transactions/transaction-row";
import styles from "@/features/transactions/transaction-list.module.css";
import type { UpcomingRow } from "@/features/transactions/upcoming-row";
import { formatDayHeader, formatSigned } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";
import type { MouseEvent } from "react";

const placeholderRows = 5;
const separator = " \u00b7 ";

// Ledger sheet L15: Date, Description, Category and Amount; "brief" drops Category.
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
  const spaLink = useSpaLink();
  const words = { today: t("date.today"), yesterday: t("date.yesterday") };
  return (
    <Table columns={brief ? 3 : 4}>
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{t("transactions.list")}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("transactions.column.date")}
            </TableColumnHeader>
            <TableColumnHeader>
              {t("transactions.column.description")}
            </TableColumnHeader>
            {!brief && (
              <TableColumnHeader>
                {t("transactions.column.category")}
              </TableColumnHeader>
            )}
            <TableColumnHeader numeric>
              {t("transactions.column.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={placeholderRows} />
        ) : (
          <TableBody>
            {upcoming.map((row) => (
              <TableRow key={row.id}>
                <TableCell text="nowrap">
                  <time dateTime={row.date} className={styles.upcoming}>
                    {formatDayHeader(row.date, today, locale, words)}
                  </time>
                </TableCell>
                <TableCell>
                  <span className={styles.upcoming}>
                    {row.description}
                    {row.account !== "" && separator + row.account}
                  </span>
                </TableCell>
                {!brief && (
                  <TableCell>
                    <span className={styles.upcoming}>
                      {row.kind === undefined
                        ? ""
                        : t(`schedule.kind.${row.kind}`)}
                    </span>
                  </TableCell>
                )}
                <TableCell numeric text="nowrap">
                  <span className={styles.upcoming}>
                    {formatSigned(
                      row.money,
                      scale(row.money.currency),
                      locale,
                      {
                        symbol: row.money.currency !== baseCurrency,
                      },
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {upcoming.length > 0 && (
              <TableRow>
                <TableCell text="nowrap">
                  <span className={styles.today}>{t("date.today")}</span>
                </TableCell>
                <TableCell>
                  <span className={styles.muted}>
                    {t("transactions.upcoming.note")}
                  </span>
                </TableCell>
                {!brief && <TableCell />}
                <TableCell />
              </TableRow>
            )}
            {rows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell text="nowrap">
                  {rows[i - 1]?.date === row.date ? null : (
                    <time dateTime={row.date} className={styles.muted}>
                      {formatDayHeader(row.date, today, locale, words)}
                    </time>
                  )}
                </TableCell>
                <TableCell>
                  <span className={row.voided ? styles.voided : undefined}>
                    <Link
                      {...spaLink(`/transactions/${row.id}`)}
                      {...(onSelect === undefined
                        ? {}
                        : {
                            onClick: (event: MouseEvent) => {
                              if (
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey
                              )
                                return;
                              event.preventDefault();
                              onSelect(row.id);
                            },
                            "aria-current":
                              row.id === selected
                                ? ("true" as const)
                                : undefined,
                          })}
                      variant="neutral"
                      underline={row.id === selected ? "always" : "hover"}
                    >
                      {row.title === ""
                        ? t("transactions.untitled")
                        : row.title}
                    </Link>
                    {[row.accounts, ...row.tags]
                      .filter((part) => part !== "")
                      .map((part, j) => (
                        <span key={String(j)} className={styles.muted}>
                          {separator + part}
                        </span>
                      ))}
                  </span>
                </TableCell>
                {!brief && (
                  <TableCell>
                    <RowCategory row={row} />
                  </TableCell>
                )}
                <TableCell numeric text="nowrap">
                  <MoneyText
                    money={row.money}
                    scale={scale(row.money.currency)}
                    symbol={row.money.currency !== baseCurrency}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
        {loadingMore && <TableLoader skeletonRows={placeholderRows} />}
      </TableContent>
    </Table>
  );
}
