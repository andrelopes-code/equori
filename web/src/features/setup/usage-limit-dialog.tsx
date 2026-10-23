import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { NumberField } from "@slotted/react/number-field";
import { Stack } from "@slotted/react/stack";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import { useSetUsageLimit } from "@/features/setup/api";
import type { UsageRow } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

// The daily limits the owner copies from the provider's console (ADR 019 U4); an empty field
// removes its limit.
export function UsageLimitDialog({
  row,
  onClose,
}: {
  row: UsageRow;
  onClose: () => void;
}) {
  const t = useT();
  const formId = useId();
  const save = useSetUsageLimit();
  const [requests, setRequests] = useState<number | null>(
    row.requests_per_day ?? null,
  );
  const [tokens, setTokens] = useState<number | null>(
    row.tokens_per_day ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("assistant.limits.title", { model: row.model })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              save
                .mutateAsync({
                  provider_id: row.provider_id,
                  model: row.model,
                  ...(requests === null ? {} : { requests_per_day: requests }),
                  ...(tokens === null ? {} : { tokens_per_day: tokens }),
                })
                .then(onClose)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <Stack gap={4}>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}
              <Field>
                <FieldLabel>{t("assistant.limits.requests")}</FieldLabel>
                <NumberField
                  name="requests_per_day"
                  value={requests}
                  min={1}
                  max={2147483647}
                  onValueChange={setRequests}
                />
              </Field>
              <Field>
                <FieldLabel>{t("assistant.limits.tokens")}</FieldLabel>
                <NumberField
                  name="tokens_per_day"
                  value={tokens}
                  min={1}
                  onValueChange={setTokens}
                />
                <FieldDescription>
                  {t("assistant.limits.hint")}
                </FieldDescription>
              </Field>
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {t("assistant.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
