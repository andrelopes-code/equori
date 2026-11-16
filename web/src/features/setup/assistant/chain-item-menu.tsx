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

interface ChainItemMenuProps {
  model: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}

// The actions of a chain target on a phone, where three buttons leave no room for the model.
export function ChainItemMenu({
  model,
  first,
  last,
  onUp,
  onDown,
  onRemove,
}: ChainItemMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            variant="ghost"
            tone="secondary"
            aria-label={t("assistant.chain.actions", { model })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem disabled={first} onSelect={onUp}>
          {t("assistant.chain.up")}
        </MenuItem>
        <MenuItem disabled={last} onSelect={onDown}>
          {t("assistant.chain.down")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" onSelect={onRemove}>
          {t("assistant.chain.remove")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
