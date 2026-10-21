import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import type { CategoryEntry } from "@/features/categories/category-paths";
import { useT } from "@/i18n/i18n-provider";

export type CategoryAction =
  "transactions" | "edit" | "add-child" | "merge" | "archive" | "reopen";

export function CategoryRowMenu({
  entry,
  onAction,
}: {
  entry: CategoryEntry;
  onAction: (action: CategoryAction) => void;
}) {
  const t = useT();
  // The system accounts keep their place: only their transactions are offered (A74).
  const system = entry.systemRole !== undefined;
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("category.actions", { name: entry.path })}
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
            onAction("transactions");
          }}
        >
          {t("category.viewTransactions")}
        </MenuItem>
        {!system && !entry.archived && (
          <>
            <MenuItem
              onSelect={() => {
                onAction("edit");
              }}
            >
              {t("category.edit")}
            </MenuItem>
            <MenuItem
              onSelect={() => {
                onAction("add-child");
              }}
            >
              {t("category.addChild")}
            </MenuItem>
            <MenuItem
              onSelect={() => {
                onAction("merge");
              }}
            >
              {t("category.merge")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              onSelect={() => {
                onAction("archive");
              }}
            >
              {t("category.archive")}
            </MenuItem>
          </>
        )}
        {!system && entry.archived && (
          <MenuItem
            onSelect={() => {
              onAction("reopen");
            }}
          >
            {t("category.reopen")}
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
