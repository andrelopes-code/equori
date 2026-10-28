import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarOverflow,
  ActionBarStatus,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { MenuItem } from "@slotted/react/menu";
import { PageFooter } from "@slotted/react/page";
import { Text } from "@slotted/react/typography";
import { useContext, useEffect } from "react";

import { PlanningFooter } from "@/features/planning/planning-footer";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

// What the pending changes add up to and when they apply, with the two ways out (spec 5.1).
// It renders nothing in place: the bar is the planning page's footer while a change is
// pending, so the Page paints its ground, its rule and its edge-to-edge stick.
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
  const setFooter = useContext(PlanningFooter);
  // One identity each, so the footer is set again only when what it shows changes.
  const discard = useStableCallback(onDiscard);
  const save = useStableCallback(onSave);
  const status = t("plan.status", {
    changes:
      pending === 1
        ? t("plan.changesOne")
        : t("plan.changes", { count: String(pending) }),
    delta,
    applies,
  });
  const discardLabel = t("plan.discard");
  const saveLabel = t("plan.save");
  useEffect(() => {
    setFooter(
      pending === 0 ? null : (
        <PageFooter>
          <ActionBar aria-label={saveLabel}>
            <ActionBarStatus>
              <Text size="sm" numeric="tabular">
                {status}
              </Text>
            </ActionBarStatus>
            <ActionBarActions>
              <ActionBarAction
                counterpart={
                  <MenuItem onSelect={discard}>{discardLabel}</MenuItem>
                }
              >
                <Button variant="ghost" tone="secondary" onClick={discard}>
                  {discardLabel}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  loading={saving}
                  aria-keyshortcuts="Control+S"
                  onClick={save}
                >
                  {saveLabel}
                </Button>
              </ActionBarAction>
              <ActionBarOverflow />
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      ),
    );
  }, [
    setFooter,
    pending,
    status,
    saving,
    discard,
    save,
    discardLabel,
    saveLabel,
  ]);
  useEffect(
    () => () => {
      setFooter(null);
    },
    [setFooter],
  );
  return null;
}
