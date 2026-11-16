import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

interface ProviderRowMenuProps {
  name: string;
  checking: boolean;
  deleting: boolean;
  onEdit: () => void;
  onCheck: () => void;
  onModels: () => void;
  onDelete: () => void;
}

// The actions of a provider: edit, key check, model list and delete. Edit stands here too
// because a phone row holds the menu alone.
export function ProviderRowMenu({
  name,
  checking,
  deleting,
  onEdit,
  onCheck,
  onModels,
  onDelete,
}: ProviderRowMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            loading={checking || deleting}
            aria-label={t("assistant.provider.actions", { name })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onEdit}>{t("assistant.provider.edit")}</MenuItem>
        <MenuItem onSelect={onCheck}>{t("assistant.key.check")}</MenuItem>
        <MenuItem onSelect={onModels}>
          {t("assistant.provider.models")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" onSelect={onDelete}>
          {t("assistant.provider.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
