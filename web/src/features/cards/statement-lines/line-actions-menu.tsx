import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuTrigger } from "@slotted/react/menu";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";

interface LineActionsMenuProps {
  name: string;
  children: ReactNode;
}

// The commands of a statement line besides opening it (refund, dispute, installment plan), in a
// menu beside the row on a phone (mobile.md M5).
export function LineActionsMenu({ name, children }: LineActionsMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            variant="ghost"
            tone="secondary"
            aria-label={t("statement.lineActions", { name })}
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
