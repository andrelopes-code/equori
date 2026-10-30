import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useCreateCard } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

export function AddCardDialog({
  accountId,
  onDone,
  onCancel,
}: {
  accountId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const create = useCreateCard();
  const [holder, setHolder] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [virtual, setVirtual] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("card.addCard")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const next: Record<string, string> = {};
              if (holder.trim() === "")
                next.holder = t("accountForm.problem.holder");
              if (!/^\d{4}$/u.test(lastFour))
                next.last_four = t("accountForm.problem.lastFour");
              setErrors(next);
              setSummary(null);
              if (Object.keys(next).length > 0) return;
              create
                .mutateAsync({
                  accountId,
                  card: { holder: holder.trim(), last_four: lastFour, virtual },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  if (caught instanceof ProblemError)
                    setErrors(fieldErrors(caught.problem));
                  setSummary(errorText(caught, t));
                });
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}

              <FormRow>
                <Field invalid={errors.holder !== undefined} required>
                  <FieldLabel>{t("accountForm.holder")}</FieldLabel>
                  <TextField
                    value={holder}
                    maxLength={120}
                    onChange={(event) => {
                      setHolder(event.target.value);
                    }}
                  />
                  {errors.holder !== undefined && (
                    <FieldError>{errors.holder}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.last_four !== undefined} required>
                  <FieldLabel>{t("accountForm.lastFour")}</FieldLabel>
                  <TextField
                    value={lastFour}
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) => {
                      setLastFour(event.target.value.replace(/\D/gu, ""));
                    }}
                  />
                  {errors.last_four !== undefined && (
                    <FieldError>{errors.last_four}</FieldError>
                  )}
                </Field>
              </FormRow>

              <Checkbox checked={virtual} onCheckedChange={setVirtual}>
                {t("accountForm.virtual")}
              </Checkbox>
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending}>
            {t("card.addCard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
