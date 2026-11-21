import { MenuItem } from "@slotted/react/menu";
import { Toolbar, ToolbarItem, ToolbarOverflow } from "@slotted/react/toolbar";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";

export interface HeaderToolbarAction {
  id: string;
  // The control drawn on the bar.
  control: ReactNode;
  // The menu item the control becomes when the bar has no room for it.
  label: string;
  onSelect: () => void;
}

interface HeaderToolbarProps {
  // A control that never folds, such as the help link.
  pinned: ReactNode;
  actions: readonly HeaderToolbarAction[];
}

// The actions of a page header on one line: a loose set of actions takes a row of its own under
// the title below 600 px, a menu toolbar stays on the title row and folds into its menu what does
// not fit (spec 2026-11-21-mobile-entry-forms, MF1).
export function HeaderToolbar({ pinned, actions }: HeaderToolbarProps) {
  const t = useT();

  return (
    <Toolbar aria-label={t("header.actions")} overflow="menu">
      <ToolbarItem>{pinned}</ToolbarItem>

      {actions.map((action) => (
        <ToolbarItem
          key={action.id}
          counterpart={
            <MenuItem onSelect={action.onSelect}>{action.label}</MenuItem>
          }
        >
          {action.control}
        </ToolbarItem>
      ))}

      <ToolbarOverflow />
    </Toolbar>
  );
}
