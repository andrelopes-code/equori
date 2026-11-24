import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { PageFooter } from "@slotted/react/page";

import type { HideSelection } from "@/features/instruments/hide-instrument/use-hide-selection";
import { useT } from "@/i18n/i18n-provider";

interface HideSelectionFooterProps {
  selection: HideSelection;
}

// The actions start under the marks instead of at the far end (LP-03): the reader marks and hides
// on one side of the screen (A238 HD13). Each action carries the count of the rows it changes.
// Workaround for Slotted issue #182: a status beside the actions would push them to the far end.
export function HideSelectionFooter({ selection }: HideSelectionFooterProps) {
  const t = useT();

  return (
    <PageFooter>
      <ActionBar aria-label={t("instruments.selection.label")} align="start">
        <ActionBarActions>
          {selection.toHide > 0 && (
            <ActionBarAction>
              <Button
                variant="outline"
                tone="secondary"
                loading={selection.pending}
                onClick={() => {
                  selection.setHidden(true);
                }}
              >
                {t("instruments.selection.hide", { count: selection.toHide })}
              </Button>
            </ActionBarAction>
          )}

          {selection.toShow > 0 && (
            <ActionBarAction>
              <Button
                variant="outline"
                tone="secondary"
                loading={selection.pending}
                onClick={() => {
                  selection.setHidden(false);
                }}
              >
                {t("instruments.selection.show", { count: selection.toShow })}
              </Button>
            </ActionBarAction>
          )}

          <ActionBarAction>
            <Button
              variant="ghost"
              tone="secondary"
              onClick={() => {
                selection.setMarked([]);
              }}
            >
              {t("selection.clear")}
            </Button>
          </ActionBarAction>
        </ActionBarActions>
      </ActionBar>
    </PageFooter>
  );
}
