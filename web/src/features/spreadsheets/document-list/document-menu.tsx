import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { CommandItems } from "@/features/spreadsheets/document-list/command-items";
import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { DownloadItems } from "@/features/spreadsheets/document-list/download-items";
import { useT } from "@/i18n/i18n-provider";

interface DocumentMenuProps {
  label: string;
  size?: "sm" | "md";
  // Opens the spreadsheet; absent on the page that already shows it.
  onOpen?: () => void;
  // The commands that write; absent for a member who only reads.
  onCommand?: ((kind: DocumentCommand["kind"]) => void) | undefined;
  // Hands the open spreadsheet as a file; present on its page.
  onDownload?: ((format: "xlsx" | "csv") => void) | undefined;
}

// The commands of one spreadsheet, in its row and in the header of its page.
export function DocumentMenu({
  label,
  size = "sm",
  onOpen,
  onCommand,
  onDownload,
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
        {onDownload !== undefined && <DownloadItems onDownload={onDownload} />}
        {onCommand !== undefined && <CommandItems onCommand={onCommand} />}
      </MenuContent>
    </Menu>
  );
}
