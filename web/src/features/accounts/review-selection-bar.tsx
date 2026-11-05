import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarStatus,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";

import type { ReviewSelection } from "@/features/accounts/use-review-selection";
import { useT } from "@/i18n/i18n-provider";

interface ReviewSelectionBarProps {
  selection: ReviewSelection;
}

export function ReviewSelectionBar({ selection }: ReviewSelectionBarProps) {
  const t = useT();
  const count = selection.selected.length;

  return (
    <ActionBar aria-label={t("reviewSelection.label")} present={count > 0}>
      <ActionBarStatus>{t("reviewSelection.count", { count })}</ActionBarStatus>
      <ActionBarActions>
        <ActionBarAction>
          <Button variant="ghost" tone="secondary" onClick={selection.clear}>
            {t("selection.clear")}
          </Button>
        </ActionBarAction>
        <ActionBarAction>
          <Button
            variant="ghost"
            tone="danger"
            disabled={count === 0}
            onClick={() => {
              selection.setDiscarding(true);
            }}
          >
            {t("reviewSelection.discard")}
          </Button>
        </ActionBarAction>
        <ActionBarAction>
          <Button
            variant="outline"
            disabled={count === 0}
            loading={selection.busy}
            onClick={selection.create}
          >
            {t("reviewSelection.create")}
          </Button>
        </ActionBarAction>
        <ActionBarAction>
          <Button
            disabled={count === 0}
            loading={selection.busy}
            onClick={selection.confirm}
          >
            {t("reviewSelection.confirm", { count: selection.suggestions })}
          </Button>
        </ActionBarAction>
      </ActionBarActions>
    </ActionBar>
  );
}
