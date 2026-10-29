import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { PageFooter } from "@slotted/react/page";

import { useT } from "@/i18n/i18n-provider";

interface CaptureFooterProps {
  count: number;
  clearDisabled: boolean;
  recordDisabled: boolean;
  pending: boolean;
  onClear: () => void;
  onRecord: () => void;
}

export function CaptureFooter({
  count,
  clearDisabled,
  recordDisabled,
  pending,
  onClear,
  onRecord,
}: CaptureFooterProps) {
  const t = useT();

  return (
    <PageFooter>
      <ActionBar aria-label={t("entry.actions")}>
        <ActionBarActions>
          <ActionBarAction>
            <Button
              variant="ghost"
              tone="secondary"
              disabled={clearDisabled}
              onClick={onClear}
            >
              {t("capture.clear")}
            </Button>
          </ActionBarAction>

          <ActionBarAction>
            <Button
              disabled={recordDisabled}
              loading={pending}
              aria-keyshortcuts="Control+Enter"
              onClick={onRecord}
            >
              {t("capture.record", { count })}
            </Button>
          </ActionBarAction>
        </ActionBarActions>
      </ActionBar>
    </PageFooter>
  );
}
