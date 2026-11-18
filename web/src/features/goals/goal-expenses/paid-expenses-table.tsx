import { Button } from "@slotted/react/button";
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
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Money = components["schemas"]["Money"];

export interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  money: Money;
  // Paid from the goal's own account: the row has no action.
  direct?: boolean;
}

interface PaidExpensesTableProps {
  caption: string;
  rows: readonly ExpenseRow[];
  // The word and the accessible name of the action of a row.
  action: string;
  actionName: (description: string) => string;
  pending: boolean;
  money: (m: Money) => string;
  onAction: (id: string) => void;
}

// Expense transactions of a goal, each with one action: remove it from the goal, or link it.
export function PaidExpensesTable({
  caption,
  rows,
  action,
  actionName,
  pending,
  money,
  onAction,
}: PaidExpensesTableProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <Table columns={4} variant="framed">
      <TableContent>
        <TableCaption>{caption}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("goals.expenses.description")}
            </TableColumnHeader>
            <TableColumnHeader>{t("goals.expenses.date")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("goals.expenses.amount")}
            </TableColumnHeader>
            <TableColumnHeader>{t("goals.expenses.action")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} value={row.id}>
              <TableRowHeader text="truncate">
                <Link
                  render={routeTo({
                    to: "/transactions/$id",
                    params: { id: row.id },
                  })}
                >
                  {row.description === ""
                    ? t("ledger.untitled")
                    : row.description}
                </Link>
              </TableRowHeader>
              <TableCell>{formatDate(row.date, locale)}</TableCell>
              <TableCell numeric>{money(row.money)}</TableCell>
              <TableCell>
                {row.direct === true && (
                  <Text size="sm" tone="muted">
                    {t("goals.expenses.direct")}
                  </Text>
                )}
                {row.direct !== true && (
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="secondary"
                    disabled={pending}
                    aria-label={actionName(row.description)}
                    onClick={() => {
                      onAction(row.id);
                    }}
                  >
                    {action}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
