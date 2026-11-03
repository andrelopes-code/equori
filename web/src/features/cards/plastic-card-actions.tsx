import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";

type Card = components["schemas"]["Card"];

export function PlasticCardActions({
  card,
  onEdit,
  onRemove,
}: {
  card: Card;
  onEdit: () => void;
  onRemove: () => void;
}) {
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
            aria-label={t("card.actionsOf", { digits: card.last_four })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onEdit}>{t("card.edit")}</MenuItem>
        <MenuItem onSelect={onRemove}>{t("card.remove")}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
