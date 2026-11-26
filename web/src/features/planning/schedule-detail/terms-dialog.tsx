import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { RecurrenceFields } from "@/features/planning/schedule-fields/recurrence-fields";
import { TermsDialogHeading } from "@/features/planning/schedule-detail/terms-dialog-heading";
import { useTermsDraft } from "@/features/planning/schedule-detail/use-terms-draft";
import { useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

interface TermsDialogProps {
  schedule: Schedule;
  revised?: ScheduleTerms | undefined;
  initialAmount?: number | undefined;
  initialEffectiveFrom?: string | undefined;
  onDone: () => void;
  onCancel: () => void;
}

// A new terms version from a date after the latest one, or the latest one revised: the amount,
// the recurrence or both.
export function TermsDialog({
  schedule,
  revised,
  initialAmount = 0,
  initialEffectiveFrom,
  onDone,
  onCancel,
}: TermsDialogProps) {
  const t = useT();
  const scale = useScale();
  const overlayOpen = useOverlayOpen();
  const draft = useTermsDraft({
    schedule,
    revised,
    initialAmount,
    initialEffectiveFrom,
    onDone,
  });

  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  return (
    <Dialog open={overlayOpen} size="lg" onOpenChange={openChange}>
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            draft.submit();
          }}
        >
          <DialogHeader>
            <TermsDialogHeading
              revised={revised?.effective_from}
              first={draft.first}
              after={draft.after}
            />
          </DialogHeader>
          <DialogBody>
            <FormLayout fill>
              {draft.summary !== null && (
                <FormNotice>{draft.summary}</FormNotice>
              )}

              <FormRow>
                {!draft.first && (
                  <Field
                    invalid={draft.errors.effective_from !== undefined}
                    required
                  >
                    <FieldLabel>{t("schedule.effectiveFrom")}</FieldLabel>
                    <DateInput
                      name="effective_from"
                      value={draft.from}
                      min={
                        draft.after === undefined
                          ? undefined
                          : shiftDate(draft.after, 1)
                      }
                      shortcuts={false}
                      onChange={draft.setFrom}
                    />
                    {draft.errors.effective_from !== undefined && (
                      <FieldError>{draft.errors.effective_from}</FieldError>
                    )}
                  </Field>
                )}

                <Field invalid={draft.errors.amount !== undefined}>
                  <FieldLabel>{t("schedule.amount")}</FieldLabel>
                  {draft.currency !== undefined && scale !== null && (
                    <MoneyInput
                      size="field"
                      value={draft.amount}
                      onChange={draft.setAmount}
                      currency={draft.currency}
                      scale={scale(draft.currency)}
                      sign={schedule.kind === "income" ? "income" : "expense"}
                    />
                  )}

                  {draft.errors.amount !== undefined && (
                    <FieldError>{draft.errors.amount}</FieldError>
                  )}
                </Field>
              </FormRow>

              {!draft.first && (
                <Checkbox
                  checked={draft.withRecurrence}
                  onCheckedChange={draft.setWithRecurrence}
                >
                  {t("schedule.changeRecurrence")}
                </Checkbox>
              )}

              {draft.withRecurrence && draft.recurrence !== undefined && (
                <RecurrenceFields
                  value={draft.recurrence}
                  onChange={draft.setRecurrence}
                  fill
                />
              )}
            </FormLayout>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={draft.pending}>
              {t("schedule.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
