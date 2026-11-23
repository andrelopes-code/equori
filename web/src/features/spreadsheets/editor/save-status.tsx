import { StatusIndicator } from "@slotted/react/status-indicator";

import type { SaveStatus as Status } from "@/features/spreadsheets/model/autosaver";
import { useT } from "@/i18n/i18n-provider";

interface SaveStatusProps {
  status: Status;
  editable: boolean;
}

const marks = {
  saved: "success",
  pending: "neutral",
  saving: "info",
  failed: "danger",
  conflict: "danger",
} as const;

// Whether the server holds what the screen shows, in words beside the name.
export function SaveStatus({ status, editable }: SaveStatusProps) {
  const t = useT();

  if (!editable)
    return (
      <StatusIndicator size="sm">
        {t("spreadsheets.status.readOnly")}
      </StatusIndicator>
    );

  return (
    <StatusIndicator
      size="sm"
      status={marks[status]}
      pulse={status === "saving"}
      live="polite"
    >
      {t(`spreadsheets.status.${status}`)}
    </StatusIndicator>
  );
}
