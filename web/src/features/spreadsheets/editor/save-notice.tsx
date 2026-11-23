import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import type { SaveStatus } from "@/features/spreadsheets/model/autosaver";
import { useT } from "@/i18n/i18n-provider";

interface SaveNoticeProps {
  status: SaveStatus;
  keeping: boolean;
  onSaveAgain: () => void;
  onReload: () => void;
  onKeepCopy: () => void;
}

// What the reader does about a save the server refused: try it again, or choose between the
// saved version and the screen when another window saved first.
export function SaveNotice({
  status,
  keeping,
  onSaveAgain,
  onReload,
  onKeepCopy,
}: SaveNoticeProps) {
  const t = useT();

  if (status === "failed")
    return (
      <Alert tone="danger">
        <AlertContent>
          <AlertDescription>{t("spreadsheets.failed")}</AlertDescription>
        </AlertContent>

        <AlertActions>
          <Button onClick={onSaveAgain}>{t("spreadsheets.saveAgain")}</Button>
        </AlertActions>
      </Alert>
    );

  if (status === "conflict")
    return (
      <Alert tone="warning" hideIcon>
        <AlertContent>
          <AlertTitle>{t("spreadsheets.conflict.title")}</AlertTitle>
          <AlertDescription>
            {t("spreadsheets.conflict.description")}
          </AlertDescription>
        </AlertContent>

        <AlertActions>
          <Button onClick={onReload}>
            {t("spreadsheets.conflict.reload")}
          </Button>
          <Button variant="ghost" loading={keeping} onClick={onKeepCopy}>
            {t("spreadsheets.conflict.keep")}
          </Button>
        </AlertActions>
      </Alert>
    );

  return null;
}
