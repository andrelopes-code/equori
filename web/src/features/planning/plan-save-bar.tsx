import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarOverflow,
  ActionBarStatus,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { MenuItem } from "@slotted/react/menu";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

// What the pending changes add up to and when they apply, with the two ways out (spec 5.1).
export function PlanSaveBar({
  pending,
  delta,
  applies,
  saving,
  onDiscard,
  onSave,
}: {
  pending: number;
  // The net change of the planned amount, written.
  delta: string;
  applies: string;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useT();
  return (
    <ActionBar
      aria-label={t("plan.save")}
      present={pending > 0}
      variant="raised"
      sticky
    >
      <ActionBarStatus>
        <Text size="sm" numeric="tabular">
          {t("plan.status", {
            changes:
              pending === 1
                ? t("plan.changesOne")
                : t("plan.changes", { count: String(pending) }),
            delta,
            applies,
          })}
        </Text>
      </ActionBarStatus>
      <ActionBarActions>
        <ActionBarAction
          counterpart={
            <MenuItem onSelect={onDiscard}>{t("plan.discard")}</MenuItem>
          }
        >
          <Button variant="ghost" tone="secondary" onClick={onDiscard}>
            {t("plan.discard")}
          </Button>
        </ActionBarAction>
        <ActionBarAction>
          <Button
            loading={saving}
            aria-keyshortcuts="Control+S"
            onClick={onSave}
          >
            {t("plan.save")}
          </Button>
        </ActionBarAction>
        <ActionBarOverflow />
      </ActionBarActions>
    </ActionBar>
  );
}
