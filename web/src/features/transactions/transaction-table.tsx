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
import { formatDayHeader } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

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
}: {
  rows: TransactionRow[];
  brief: boolean;
  baseCurrency: string | undefined;
  scale: (currency: string) => number;
  loading: boolean;
  loadingMore: boolean;
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
                      variant="neutral"
                      underline="hover"
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
