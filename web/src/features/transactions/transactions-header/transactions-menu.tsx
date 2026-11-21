import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuTrigger,
} from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

interface TransactionsMenuProps {
  refreshing: boolean;
  onRefresh: () => void;
  // Absent in the uncategorized queue, which never lists voided transactions.
  showVoided: boolean | undefined;
  onShowVoidedChange: (show: boolean) => void;
}

// The utilities of the list on a phone, out of the first screen (spec
// 2026-11-21-mobile-statement, MS12).
export function TransactionsMenu({
  refreshing,
  onRefresh,
  showVoided,
  onShowVoidedChange,
}: TransactionsMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            variant="ghost"
            tone="secondary"
            loading={refreshing}
            aria-label={t("transactions.actions")}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onRefresh}>{t("transactions.refresh")}</MenuItem>
        {showVoided !== undefined && (
          <MenuCheckboxItem
            checked={showVoided}
            onCheckedChange={onShowVoidedChange}
          >
            {t("transactions.showVoided")}
          </MenuCheckboxItem>
        )}
      </MenuContent>
    </Menu>
  );
}
