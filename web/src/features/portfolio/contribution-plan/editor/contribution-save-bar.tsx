import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarOverflow,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { MenuItem } from "@slotted/react/menu";
import { PageFooter } from "@slotted/react/page";

import { useT } from "@/i18n/i18n-provider";

interface ContributionSaveBarProps {
  saving: boolean;
  disabled: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

// The two ways out of edit mode, in the Page footer as the budget plan's save bar.
export function ContributionSaveBar({
  saving,
  disabled,
  onDiscard,
  onSave,
}: ContributionSaveBarProps) {
  const t = useT();

  return (
    <PageFooter>
      <ActionBar aria-label={t("contributionPlan.save")}>
        <ActionBarActions>
          <ActionBarAction
            counterpart={
              <MenuItem onSelect={onDiscard}>
                {t("contributionPlan.discard")}
              </MenuItem>
            }
          >
            <Button variant="ghost" tone="secondary" onClick={onDiscard}>
              {t("contributionPlan.discard")}
            </Button>
          </ActionBarAction>

          <ActionBarAction>
            <Button loading={saving} disabled={disabled} onClick={onSave}>
              {t("contributionPlan.save")}
            </Button>
          </ActionBarAction>

          <ActionBarOverflow />
        </ActionBarActions>
      </ActionBar>
    </PageFooter>
  );
}
