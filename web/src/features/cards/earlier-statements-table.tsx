import { Link } from "@slotted/react/link";
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

import type { Statement } from "@/features/cards/statement-groups";
import { StatementStatusTag } from "@/features/cards/statement-status-tag";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

// Complete frontend C3: the statements before the one in the header, latest first.
export function EarlierStatementsTable({
  accountId,
  statements,
  scale,
}: {
  accountId: string;
  statements: Statement[];
  scale: (currency: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const spaLink = useSpaLink();
  return (
    <Table columns={4}>
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{t("cards.earlier")}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("cards.earlier.statement")}
            </TableColumnHeader>
            <TableColumnHeader>{t("cards.current.due")}</TableColumnHeader>
            <TableColumnHeader>{t("cards.earlier.state")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("cards.current.amountDue")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {statements.map((statement) => (
            <TableRow key={statement.id}>
              <TableRowHeader>
                <Link
                  {...spaLink(`/cards/${accountId}/statements/${statement.id}`)}
                >
                  {formatReferenceMonth(statement.reference, locale)}
                </Link>
              </TableRowHeader>
              <TableCell text="nowrap">
                {formatDate(statement.due_date, locale)}
              </TableCell>
              <TableCell>
                <StatementStatusTag status={statement.status} />
              </TableCell>
              <TableCell numeric text="nowrap">
                <MoneyText
                  money={statement.amount_due}
                  scale={scale(statement.amount_due.currency)}
                  symbol={false}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
