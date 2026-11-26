import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { monthEnd } from "@/features/planning/model/agenda";
import type { BudgetRow } from "@/features/planning/model/budget-month";
import { formatMonthSlashYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type Budget = components["schemas"]["Budget"];

interface BudgetActionsProps {
  row: BudgetRow;
  month: string;
  onChangeAmount: (budget: Budget) => void;
  onEnd: (row: BudgetRow) => void;
  onDelete: (budget: Budget, name: string) => void;
}

// The menu of one budget: change its amount, see its transactions of the month, end it from the
// month, delete it. The end is offered from the current month on, after the first month (E16).
export function BudgetActions({
  row,
  month,
  onChangeAmount,
  onEnd,
  onDelete,
}: BudgetActionsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const today = useToday();

  const first = row.budget.amounts[0]?.effective_from ?? month;
  const endable = month >= today.slice(0, 7) && month > first;

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("budget.actions", { name: row.label })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem
          onSelect={() => {
            onChangeAmount(row.budget);
          }}
        >
          {t("budget.changeAmount")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            void navigate({
              to: "/transactions",
              search: {
                account_id: row.budget.category_id,
                from: `${month}-01`,
                to: monthEnd(month),
              },
            });
          }}
        >
          {t("budget.seeTransactions")}
        </MenuItem>
        <MenuSeparator />
        {endable && (
          <MenuItem
            onSelect={() => {
              onEnd(row);
            }}
          >
            {t("budget.end", { month: formatMonthSlashYear(month, locale) })}
          </MenuItem>
        )}
        <MenuItem
          tone="danger"
          onSelect={() => {
            onDelete(row.budget, row.label);
          }}
        >
          {t("budget.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
