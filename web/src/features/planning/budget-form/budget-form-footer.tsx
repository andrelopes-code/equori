import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { PageFooter } from "@slotted/react/page";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

interface BudgetFormFooterProps {
  pending: boolean;
  disabled: boolean;
  onSubmit: () => void;
}

// The actions of the form New budget: back to the budgets, or create.
export function BudgetFormFooter({
  pending,
  disabled,
  onSubmit,
}: BudgetFormFooterProps) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <PageFooter>
      <ActionBar aria-label={t("agenda.actions")}>
        <ActionBarActions>
          <ActionBarAction>
            <Button
              variant="ghost"
              tone="secondary"
              onClick={() => {
                void navigate({
                  to: "/planning",
                  search: { tab: "budgets" },
                });
              }}
            >
              {t("detail.cancel")}
            </Button>
          </ActionBarAction>
          <ActionBarAction>
            <Button loading={pending} disabled={disabled} onClick={onSubmit}>
              {t("budget.create")}
            </Button>
          </ActionBarAction>
        </ActionBarActions>
      </ActionBar>
    </PageFooter>
  );
}
