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
import { Field, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useUnlockAccount } from "@/features/accounts/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import { FormLayout } from "@/ui/form-layout";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Account = components["schemas"]["Account"];

// A8: unlocking returns the reconciled postings settled from the date to cleared and deletes the
// reconciliations from it, so they can be corrected; the sentence says so before the confirm.
export function UnlockDialog({
  account,
  lastReconciled,
  onDone,
  onCancel,
}: {
  account: Account;
  lastReconciled: string | undefined;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const [locale] = useAppLocale();
  const unlock = useUnlockAccount();
  const [from, setFrom] = useState(lastReconciled ?? account.opened_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("unlock.title", { name: account.name })}</DialogTitle>
          <DialogDescription>{t("unlock.hint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormLayout>
            <Field required>
              <FieldLabel>{t("unlock.from")}</FieldLabel>
              <DateInput
                name="from"
                value={from}
                onChange={setFrom}
                shortcuts={false}
              />
            </Field>

            {from !== "" && (
              <Text size="sm">
                {t("unlock.consequence", { date: formatDate(from, locale) })}
              </Text>
            )}

            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            disabled={from === ""}
            loading={unlock.isPending}
            onClick={() => {
              setError(null);
              unlock
                .mutateAsync({ id: account.id, from })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("unlock.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
