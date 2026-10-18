import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { toast } from "@slotted/react/toast";
import { useState } from "react";

import { ProblemError, problemMessage } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCloseAccount } from "@/features/accounts/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// Mounted only while open, so every opening starts without an error.
export function CloseAccountDialog({
  account,
  onClose,
}: {
  account: components["schemas"]["Account"];
  onClose: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const closeAccount = useCloseAccount();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await closeAccount.mutateAsync({ id: account.id, closedOn: today });
    } catch (failure) {
      setError(
        failure instanceof ProblemError
          ? problemMessage(failure.problem, t)
          : t("accounts.failed"),
      );
      return;
    }
    toast.show({ title: t("accounts.close.done") });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("accounts.close.title")}</DialogTitle>
          <DialogDescription>
            {t("accounts.close.description", {
              name: account.name,
              date: formatDate(today, locale),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error !== null && (
            <Alert tone="danger" role="alert">
              <AlertContent>
                <AlertDescription>{error}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button tone="secondary" variant="outline" onClick={onClose}>
            {t("accounts.cancel")}
          </Button>
          <Button
            tone="danger"
            disabled={closeAccount.isPending}
            onClick={() => void submit()}
          >
            {t("accounts.close.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
