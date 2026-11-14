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
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

interface NewEntryFooterProps {
  ready: boolean;
  pending: boolean;
  onDiscard: () => void;
  onSaveAnother: () => void;
  onSave: () => void;
}

export function NewEntryFooter({
  ready,
  pending,
  onDiscard,
  onSaveAnother,
  onSave,
}: NewEntryFooterProps) {
  const t = useT();
  const compact = useMediaQuery(compactQuery);

  return (
    <PageFooter>
      <ActionBar aria-label={t("entry.actions")}>
        <ActionBarActions>
          {/* On a phone the bar keeps one row: Save, and a menu with the other two. */}
          <ActionBarAction
            priority={compact ? "always" : "low"}
            counterpart={
              <MenuItem onSelect={onDiscard}>{t("entry.discard")}</MenuItem>
            }
          >
            <Button variant="ghost" tone="secondary" onClick={onDiscard}>
              {t("entry.discard")}
            </Button>
          </ActionBarAction>

          <ActionBarAction
            priority={compact ? "always" : "low"}
            counterpart={
              <MenuItem disabled={!ready} onSelect={onSaveAnother}>
                {t("entry.saveAnother")}
              </MenuItem>
            }
          >
            <Button
              variant="outline"
              tone="secondary"
              disabled={!ready}
              loading={pending}
              onClick={onSaveAnother}
            >
              {t("entry.saveAnother")}
            </Button>
          </ActionBarAction>

          <ActionBarAction>
            <Button
              fullWidth={compact}
              disabled={!ready}
              loading={pending}
              aria-keyshortcuts="Control+Enter"
              onClick={onSave}
            >
              {t("entry.save")}
            </Button>
          </ActionBarAction>

          <ActionBarOverflow label={t("entry.moreActions")} />
        </ActionBarActions>
      </ActionBar>
    </PageFooter>
  );
}
