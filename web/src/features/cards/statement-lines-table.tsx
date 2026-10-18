import { useQuery } from "@tanstack/react-query";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
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
  TableSummary,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import { useApi } from "@/api/api-context";
import { statementQuery } from "@/features/cards/api";
import styles from "@/features/cards/card-overview-page.module.css";
import type { Statement } from "@/features/cards/statement-groups";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";

// Complete frontend C3: the statement's charges and credits, latest first, closed by its total.
// A payment settles the statement and stands outside its lines. A line reads as owed: the
// posting of a charge is negative on the card account, so its sign turns.
export function StatementLinesTable({
  statement,
  scale,
}: {
  statement: Statement;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const detail = useQuery(
    statementQuery(useApi(), statement.account_id, statement.id),
  );
  if (detail.isError) {
    return (
      <QueryError
        error={detail.error}
        onRetry={() => {
          void detail.refetch();
        }}
      />
    );
  }
  if (detail.data === undefined) {
    return (
      <SkeletonRegion>
        <Skeleton shape="block" blockSize="8rem" />
      </SkeletonRegion>
    );
  }
  const lines = detail.data.postings
    .filter((line) => line.card_role !== "payment")
    .sort((a, b) => b.date.localeCompare(a.date));
  const currency = statement.amount_due.currency;
  return (
    <Table columns={3}>
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{t("cards.lines")}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("cards.lines.date")}</TableColumnHeader>
            <TableColumnHeader>
              {t("cards.lines.description")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("cards.lines.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.length === 0 && (
            <TableRow>
              <TableCell />
              <TableCell>
                <Text size="sm" tone="muted">
                  {t("cards.lines.empty")}
                </Text>
              </TableCell>
              <TableCell />
            </TableRow>
          )}
          {lines.map((line) => (
            <TableRow key={line.transaction_id}>
              <TableCell text="nowrap">
                <span className={styles.muted}>
                  {formatDayMonth(line.date, locale)}
                </span>
              </TableCell>
              <TableRowHeader>
                {line.description}
                {line.installment !== undefined && (
                  <span className={styles.muted}>
                    {t("cards.lines.installment", {
                      number: line.installment.number,
                      count: line.installment.count,
                    })}
                  </span>
                )}
              </TableRowHeader>
              <TableCell numeric text="nowrap">
                <MoneyText
                  money={{ amount: -line.amount.amount, currency }}
                  scale={scale}
                  symbol={false}
                />
              </TableCell>
            </TableRow>
          ))}
          {statement.opening.amount !== 0 && (
            <TableRow>
              <TableCell />
              <TableRowHeader>
                <span className={styles.muted}>{t("cards.lines.opening")}</span>
              </TableRowHeader>
              <TableCell numeric text="nowrap">
                <MoneyText
                  money={statement.opening}
                  scale={scale}
                  symbol={false}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableSummary>
          <TableRow>
            <TableCell />
            <TableRowHeader>
              {lines.length === 1
                ? t("cards.lines.total.one")
                : t("cards.lines.total.other", { count: lines.length })}
            </TableRowHeader>
            <TableCell numeric text="nowrap">
              <MoneyText
                money={statement.amount_due}
                scale={scale}
                symbol={false}
              />
            </TableCell>
          </TableRow>
        </TableSummary>
      </TableContent>
    </Table>
  );
}
