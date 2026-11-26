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
  TableSummary,
} from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Installment = components["schemas"]["BudgetPlanInstallment"];

interface InstallmentsTableProps {
  items: readonly Installment[];
  // Card names by account id.
  cards: ReadonlyMap<string, string>;
  total: number;
  format: PlanFormat;
}

// One charge per row: the purchase as a link to its transaction, the card, the installment and
// the amount, with the plan's total under them (budget plan A129).
export function InstallmentsTable({
  items,
  cards,
  total,
  format,
}: InstallmentsTableProps) {
  const t = useT();

  return (
    <Table columns={4} variant="framed">
      <TableContent>
        <TableCaption>{t("plan.installments.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("plan.installments.col.purchase")}
            </TableColumnHeader>
            <TableColumnHeader>
              {t("plan.installments.col.card")}
            </TableColumnHeader>
            <TableColumnHeader>
              {t("plan.installments.col.number")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("plan.installments.col.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={`${item.transaction_id}-${String(i)}`}>
              <TableRowHeader text="truncate">
                <Link
                  render={routeTo({
                    to: "/transactions/$id",
                    params: { id: item.transaction_id },
                  })}
                >
                  {item.description === ""
                    ? t("ledger.untitled")
                    : item.description}
                </Link>
              </TableRowHeader>
              <TableCell text="truncate">
                {cards.get(item.card_account_id) ?? t("plan.dash")}
              </TableCell>
              <TableCell text="nowrap">
                {item.number === undefined
                  ? t("plan.installments.anticipation")
                  : t("plan.installments.of", {
                      number: String(item.number),
                      count: String(item.count),
                    })}
              </TableCell>
              <TableCell numeric>{format.money(item.amount.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableSummary>
          <TableRow>
            <TableRowHeader colSpan={3}>
              {t("plan.installments.total")}
            </TableRowHeader>
            <TableCell numeric>{format.money(total)}</TableCell>
          </TableRow>
        </TableSummary>
      </TableContent>
    </Table>
  );
}
