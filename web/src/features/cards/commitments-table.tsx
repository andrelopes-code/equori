import { useQueries } from "@tanstack/react-query";
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
} from "@slotted/react/table";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import { useApi } from "@/api/api-context";
import { commitmentQuery } from "@/features/cards/api";
import { addMonths } from "@/features/cards/reference-months";
import { formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { BudgetBar } from "@/ui/budget-bar";
import { MoneyText } from "@/ui/money-text";
import { QueryError } from "@/ui/query-error";

const months = 6;

// Complete frontend C3: the installments already billed to the six statements after this one.
export function CommitmentsTable({
  accountId,
  reference,
  scale,
}: {
  accountId: string;
  reference: string;
  scale: number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const results = useQueries({
    queries: Array.from({ length: months }, (_, n) =>
      commitmentQuery(api, accountId, addMonths(reference, n + 1)),
    ),
  });
  const failed = results.find((result) => result.isError);
  if (failed?.error) {
    return (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const result of results) {
            if (result.isError) void result.refetch();
          }
        }}
      />
    );
  }
  const rows = results.flatMap((result) =>
    result.data === undefined ? [] : [result.data],
  );
  if (rows.length < months) {
    return (
      <SkeletonRegion>
        <Skeleton shape="block" blockSize="8rem" />
      </SkeletonRegion>
    );
  }
  const largest = Math.max(...rows.map((row) => row.amount.amount));
  return (
    <Table columns={3}>
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{t("cards.committed")}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("cards.committed.month")}</TableColumnHeader>
            <TableColumnHeader>
              <VisuallyHidden>{t("cards.committed.amount")}</VisuallyHidden>
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("cards.committed.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.month}>
              <TableRowHeader>
                {formatReferenceMonth(row.month, locale)}
              </TableRowHeader>
              <TableCell>
                <BudgetBar
                  share={largest > 0 ? row.amount.amount / largest : 0}
                  tone="neutral"
                />
              </TableCell>
              <TableCell numeric text="nowrap">
                <MoneyText money={row.amount} scale={scale} symbol={false} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
