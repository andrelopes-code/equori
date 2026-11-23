import { MenuItem } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

interface DownloadItemsProps {
  onDownload: (format: "xlsx" | "csv") => void;
}

// The files the open spreadsheet is handed as.
export function DownloadItems({ onDownload }: DownloadItemsProps) {
  const t = useT();

  return (
    <>
      <MenuItem
        onSelect={() => {
          onDownload("xlsx");
        }}
      >
        {t("spreadsheets.downloadXlsx")}
      </MenuItem>
      <MenuItem
        onSelect={() => {
          onDownload("csv");
        }}
      >
        {t("spreadsheets.downloadCsv")}
      </MenuItem>
    </>
  );
}
