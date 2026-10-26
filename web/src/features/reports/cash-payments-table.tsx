import { Link } from "@slotted/react/link";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
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
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { cashPaymentsQuery } from "@/features/reports/api";
import type { ReportPeriod } from "@/features/reports/report-period";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { useAppLink } from "@/ui/use-app-link";

// The card payments that make a category's cash total, each opening its payment and the
// statement it pays (N20).
export function CashPaymentsTable({
  categoryId,
  name,
  income,
  period,
  money,
}: {
  categoryId: string;
  name: string;
  // An income category's postings are negative; the table shows earnings positive, as the totals do.
  income: boolean;
  period: ReportPeriod;
  money: (amount: number) => string;
}) {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const follow = useAppLink();
  const payments = useQuery(
    cashPaymentsQuery(api, categoryId, period.from, period.to),
  );
  const sign = income ? -1 : 1;
  if (payments.error !== null)
    return (
      <QueryError
        error={payments.error}
        onRetry={() => void payments.refetch()}
      />
    );
  if (payments.data?.length === 0)
    return (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>
            {t("report.cash.empty", { name })}
          </ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  const total = (payments.data ?? []).reduce(
    (sum, p) => sum + p.amount.amount * sign,
    0,
  );
  return (
    <Table columns={3} variant="framed">
      <TableContent>
        <TableCaption>{t("report.cash.title", { name })}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("report.cash.payment")}</TableColumnHeader>
            <TableColumnHeader>{t("report.cash.statement")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("report.cash.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {payments.data === undefined ? (
          <TableLoader skeletonRows={3} />
        ) : (
          <>
            <TableBody>
              {payments.data.map((p) => (
                <TableRow
                  key={`${p.payment_transaction_id}-${p.statement_id}`}
                  value={`${p.payment_transaction_id}-${p.statement_id}`}
                >
                  <TableRowHeader>
                    <Link
                      variant="neutral"
                      underline="hover"
                      href={`/transactions/${p.payment_transaction_id}`}
                      onClick={follow({
                        to: "/transactions/$id",
                        params: { id: p.payment_transaction_id },
                      })}
                    >
                      {formatDate(p.date, tag)}
                    </Link>
                  </TableRowHeader>
                  <TableCell>
                    <Link
                      variant="neutral"
                      underline="hover"
                      href={`/cards/${p.card_account_id}/statements/${p.statement_id}`}
                      onClick={follow({
                        to: "/cards/$accountId/statements/$statementId",
                        params: {
                          accountId: p.card_account_id,
                          statementId: p.statement_id,
                        },
                      })}
                    >
                      {formatReferenceMonth(p.statement_reference, tag)}
                    </Link>
                  </TableCell>
                  <TableCell numeric>{money(p.amount.amount * sign)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableSummary>
              <TableRow>
                <TableRowHeader>{t("report.total")}</TableRowHeader>
                <TableCell />
                <TableCell numeric>{money(total)}</TableCell>
              </TableRow>
            </TableSummary>
          </>
        )}
      </TableContent>
    </Table>
  );
}
