import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

// The menu of an overview block's header; block is the title, for the trigger's name.
export function HideBlockMenu({
  block,
  onHide,
}: {
  block: string;
  onHide: () => void;
}) {
  const t = useT();
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            variant="ghost"
            tone="secondary"
            aria-label={t("overview.block.options", { block })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onHide}>{t("overview.block.hide")}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
