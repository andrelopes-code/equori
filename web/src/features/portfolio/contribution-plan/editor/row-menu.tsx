import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuTrigger } from "@slotted/react/menu";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";

interface RowMenuProps {
  name: string;
  // The items of the menu.
  children: ReactNode;
}

// The last column of an edit row: the actions of a group or an asset.
export function RowMenu({ name, children }: RowMenuProps) {
  const t = useT();
  const label = name.trim() === "" ? t("contributionPlan.className") : name;

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("contributionPlan.rowMenu", { name: label })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>{children}</MenuContent>
    </Menu>
  );
}
