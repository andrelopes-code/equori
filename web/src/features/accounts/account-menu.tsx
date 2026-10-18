import { IconButton } from "@slotted/react/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";

export function AccountMenu({
  name,
  onEdit,
  onClose,
}: {
  name: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            aria-label={t("accounts.actions", { name })}
            tone="secondary"
            variant="ghost"
          >
            <IconGlyph name="more" />
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onEdit}>{t("accounts.action.edit")}</MenuItem>
        <MenuItem tone="danger" onSelect={onClose}>
          {t("accounts.action.close")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
