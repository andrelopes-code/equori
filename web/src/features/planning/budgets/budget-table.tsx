import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableGroupRow,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import { BudgetTableRow } from "@/features/planning/budgets/budget-table-row";
import type { BudgetGroup } from "@/features/planning/model/budget-month";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import bleed from "@/ui/display/section-bleed.module.css";

type Budget = components["schemas"]["Budget"];

interface BudgetTableProps {
  groups: readonly BudgetGroup[];
  month: string;
  scale: (code: string) => number;
  onChangeAmount: (budget: Budget) => void;
  onDelete: (budget: Budget, name: string) => void;
}

// The budgets of the month in one table: a group row per top category with what went out of its
// room, then one line per budget.
export function BudgetTable({
  groups,
  month,
  scale,
  onChangeAmount,
  onDelete,
}: BudgetTableProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  return (
    <Table columns={5} variant="ruled" className={bleed.bleed}>
      <TableContent aria-label={t("budget.title")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("budget.col.budget")}</TableColumnHeader>
            <TableColumnHeader>{t("budget.col.progress")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("budget.col.spent")}
            </TableColumnHeader>
            <TableColumnHeader>{t("budget.col.status")}</TableColumnHeader>
            <TableColumnHeader sticky="end">
              {t("budget.col.actions")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group) => {
            const s = group.subtotal;
            const room = {
              ...s.planned,
              amount: s.planned.amount + s.carried.amount,
            };
            const scaleOf = scale(s.spent.currency);
            return (
              <Fragment key={group.root.id}>
                <TableGroupRow
                  end={t("budget.groupTotal", {
                    spent: fmt.money(s.spent, scaleOf),
                    room: fmt.money(room, scaleOf),
                  })}
                >
                  {group.root.name}
                </TableGroupRow>
                {group.rows.map((row) => (
                  <BudgetTableRow
                    key={row.budget.id}
                    row={row}
                    month={month}
                    scale={scale}
                    onChangeAmount={onChangeAmount}
                    onDelete={onDelete}
                  />
                ))}
              </Fragment>
            );
          })}
        </TableBody>
      </TableContent>
    </Table>
  );
}
