import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";

import type { MovedField } from "@/features/transactions/moved-fields";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const fieldWords: Record<MovedField, MessageKey> = {
  kind: "entry.kind",
  amount: "entry.amount",
  date: "entry.date",
  account: "entry.account",
  category: "category.label",
  to: "entry.to",
  payee: "facts.payee",
  description: "facts.description",
  tags: "facts.tags",
  postings: "detail.postings",
};

// FM-08: the transaction was read again; the reader keeps what they wrote and chooses.
export function CorrectionConflict({
  moved,
  busy,
  onOverwrite,
  onRestart,
}: {
  moved: readonly MovedField[];
  busy: boolean;
  onOverwrite: () => void;
  onRestart: () => void;
}) {
  const t = useT();
  const fields = moved.map((field) => t(fieldWords[field])).join(", ");
  return (
    <Alert tone="warning">
      <AlertContent>
        <AlertTitle>{t("conflict.title")}</AlertTitle>
        <AlertDescription>
          {moved.length === 0
            ? t("conflict.nothingMoved")
            : t("conflict.moved", { fields })}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button variant="ghost" onClick={onRestart}>
          {t("conflict.restart")}
        </Button>
        <Button loading={busy} onClick={onOverwrite}>
          {t("conflict.overwrite")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
