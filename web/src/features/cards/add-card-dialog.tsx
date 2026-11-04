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
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useCreateCard, useUpdateCard } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Card = components["schemas"]["Card"];

// Adds a card to the account; given a card, edits its holder and last four digits.
export function AddCardDialog({
  accountId,
  card,
  onDone,
  onCancel,
}: {
  accountId: string;
  card?: Card;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const create = useCreateCard();
  const update = useUpdateCard();
  const [holder, setHolder] = useState(card?.holder ?? "");
  const [lastFour, setLastFour] = useState(card?.last_four ?? "");
  const [virtual, setVirtual] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const label = t(card === undefined ? "card.addCard" : "card.editCard");
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
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
              const request: Promise<unknown> =
                card === undefined
                  ? create.mutateAsync({
                      accountId,
                      card: {
                        holder: holder.trim(),
                        last_four: lastFour,
                        virtual,
                      },
                    })
                  : update.mutateAsync({
                      id: card.id,
                      holder: holder.trim(),
                      last_four: lastFour,
                    });
              request.then(onDone).catch((caught: unknown) => {
                if (caught instanceof ProblemError)
                  setErrors(fieldErrors(caught.problem));
                setSummary(errorText(caught, t));
              });
            }}
          >
            <FormLayout>
              {summary !== null && <FormNotice>{summary}</FormNotice>}

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

              {card === undefined && (
                <Checkbox checked={virtual} onCheckedChange={setVirtual}>
                  {t("accountForm.virtual")}
                </Checkbox>
              )}
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={create.isPending || update.isPending}
          >
            {card === undefined ? label : t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
