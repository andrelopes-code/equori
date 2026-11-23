import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { useT } from "@/i18n/i18n-provider";

interface DocumentMenuProps {
  label: string;
  size?: "sm" | "md";
  // Opens the spreadsheet; absent on the page that already shows it.
  onOpen?: () => void;
  onCommand: (kind: DocumentCommand["kind"]) => void;
}

// The commands of one spreadsheet, in its row and in the header of its page.
export function DocumentMenu({
  label,
  size = "sm",
  onOpen,
  onCommand,
}: DocumentMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size={size}
            variant="ghost"
            tone="secondary"
            aria-label={label}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />

      <MenuContent>
        {onOpen !== undefined && (
          <MenuItem onSelect={onOpen}>{t("spreadsheets.open")}</MenuItem>
        )}
        <MenuItem
          onSelect={() => {
            onCommand("rename");
          }}
        >
          {t("spreadsheets.rename")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onCommand("copy");
          }}
        >
          {t("spreadsheets.copy")}
        </MenuItem>
        <MenuItem
          tone="danger"
          onSelect={() => {
            onCommand("delete");
          }}
        >
          {t("spreadsheets.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
