import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
  ActionBarStatus,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";

import { useT } from "@/i18n/i18n-provider";

interface UnconfirmedSelectionBarProps {
  count: number;
  onClear: () => void;
  onVoid: () => void;
}

export function UnconfirmedSelectionBar({
  count,
  onClear,
  onVoid,
}: UnconfirmedSelectionBarProps) {
  const t = useT();

  return (
    <ActionBar aria-label={t("selection.label")} present={count > 0}>
      <ActionBarStatus>{t("selection.count", { count })}</ActionBarStatus>
      <ActionBarActions>
        <ActionBarAction>
          <Button variant="ghost" tone="secondary" onClick={onClear}>
            {t("selection.clear")}
          </Button>
        </ActionBarAction>
        <ActionBarAction>
          <Button variant="ghost" tone="danger" onClick={onVoid}>
            {t("selection.void")}
          </Button>
        </ActionBarAction>
      </ActionBarActions>
    </ActionBar>
  );
}
