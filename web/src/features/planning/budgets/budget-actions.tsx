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
import { useT } from "@/i18n/i18n-provider";

type Budget = components["schemas"]["Budget"];

interface BudgetActionsProps {
  row: BudgetRow;
  month: string;
  onChangeAmount: (budget: Budget) => void;
  onDelete: (budget: Budget, name: string) => void;
}

// The menu of one budget: change its amount, see its transactions of the month, delete it.
export function BudgetActions({
  row,
  month,
  onChangeAmount,
  onDelete,
}: BudgetActionsProps) {
  const t = useT();
  const navigate = useNavigate();

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
