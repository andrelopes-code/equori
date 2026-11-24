import { IconButtonLink } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipLayer,
  TooltipTrigger,
} from "@slotted/react/tooltip";
import { Link } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

interface HoldingIncomeLinkProps {
  accountID: string;
  name: string;
}

// IE6: the income form on the account of the row. The tooltip states the action on one line; the
// accessible name adds the investment.
export function HoldingIncomeLink({ accountID, name }: HoldingIncomeLinkProps) {
  const t = useT();

  return (
    <Tooltip describes="none">
      <TooltipTrigger
        render={(trigger) => (
          <IconButtonLink
            {...trigger}
            aria-label={t("holdings.income.recordOf", { name })}
            size="sm"
            variant="ghost"
            tone="secondary"
            render={(props) => (
              <Link
                {...props}
                to="/transactions/new"
                search={{ kind: "investment_income", account_id: accountID }}
              />
            )}
          >
            <Icon>
              <Glyph name="plus" />
            </Icon>
          </IconButtonLink>
        )}
      />
      <TooltipLayer>
        <TooltipContent>{t("holdings.income.record")}</TooltipContent>
      </TooltipLayer>
    </Tooltip>
  );
}
