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

import type { components } from "@/api/schema.gen";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Budget = components["schemas"]["Budget"];

interface BudgetAmountsTableProps {
  budget: Budget;
  scale: (code: string) => number;
}

// The versions of a budget by month; an end reads "Ended" in place of an amount (budget end E17).
export function BudgetAmountsTable({ budget, scale }: BudgetAmountsTableProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  return (
    <Table columns={2} variant="framed">
      <TableContent>
        <TableCaption>{t("budget.amounts")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("budget.from")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("budget.amount")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {budget.amounts.map((a) => (
            <TableRow key={a.effective_from} value={a.effective_from}>
              <TableRowHeader>
                {formatMonthTitle(a.effective_from, locale)}
              </TableRowHeader>
              <TableCell numeric>
                {a.ended
                  ? t("budget.ended")
                  : fmt.money(a.amount, scale(a.amount.currency))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
