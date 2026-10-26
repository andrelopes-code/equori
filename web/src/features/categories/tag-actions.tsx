import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

export function TagActions({
  tag,
  onDelete,
}: {
  tag: string;
  onDelete: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("tags.actions", { name: tag })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem
          onSelect={() => {
            void navigate({ to: "/transactions", search: { tag } });
          }}
        >
          {t("category.viewTransactions")}
        </MenuItem>
        <MenuItem tone="danger" onSelect={onDelete}>
          {t("tags.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
