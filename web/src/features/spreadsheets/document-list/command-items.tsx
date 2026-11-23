import { MenuItem } from "@slotted/react/menu";

import type { DocumentCommand } from "@/features/spreadsheets/document-list/document-command";
import { useT } from "@/i18n/i18n-provider";

interface CommandItemsProps {
  onCommand: (kind: DocumentCommand["kind"]) => void;
}

// The commands that change one spreadsheet.
export function CommandItems({ onCommand }: CommandItemsProps) {
  const t = useT();

  return (
    <>
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
    </>
  );
}
