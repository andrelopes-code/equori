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
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { useMemo, type SyntheticEvent } from "react";

import type { components } from "@/api/schema.gen";
import {
  dayCountLabel,
  dayCounts,
} from "@/features/instruments/model/instrument-labels";
import { TermsRateFields } from "@/features/instruments/terms/terms-rate-fields";
import { useTermsDraft } from "@/features/instruments/terms/use-terms-draft";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { DateInput } from "@/ui/form-fields/date-input";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Terms = components["schemas"]["FixedIncomeTerms"];
type DayCount = components["schemas"]["TermsDayCount"];

interface TermsDialogProps {
  code: string;
  quote: string;
  scale: number;
  terms: Terms | null;
  onDone: () => void;
  onCancel: () => void;
}

// Sets the terms of a fixed income instrument. The server replaces the earlier terms and the
// prices accrued from them, and the form says so before the write.
export function TermsDialog({
  code,
  quote,
  scale,
  terms,
  onDone,
  onCancel,
}: TermsDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const { draft, errors, summary, pending, change, submit } = useTermsDraft({
    code,
    terms,
    onDone,
  });

  const dayCountChoices = useMemo(
    () => dayCounts.map((d) => ({ value: d, label: dayCountLabel(t, d) })),
    [t],
  );

  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("terms.title")}</DialogTitle>
            <DialogDescription>
              {t("terms.dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormLayout>
              {summary !== null && <FormNotice>{summary}</FormNotice>}
              <Alert tone="warning">
                <AlertContent>
                  <AlertDescription>{t("terms.replaceNote")}</AlertDescription>
                </AlertContent>
              </Alert>
              <FormRow>
                <Field invalid={errors.issued_on !== undefined} required>
                  <FieldLabel>{t("terms.issuedOn")}</FieldLabel>
                  <DateInput
                    name="issued_on"
                    value={draft.issued}
                    shortcuts={false}
                    onChange={(issued) => {
                      change({ issued });
                    }}
                  />
                  {errors.issued_on !== undefined && (
                    <FieldError>{errors.issued_on}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.matures_on !== undefined} required>
                  <FieldLabel>{t("terms.maturesOn")}</FieldLabel>
                  <DateInput
                    name="matures_on"
                    value={draft.matures}
                    shortcuts={false}
                    onChange={(matures) => {
                      change({ matures });
                    }}
                  />
                  {errors.matures_on !== undefined && (
                    <FieldError>{errors.matures_on}</FieldError>
                  )}
                </Field>
              </FormRow>

              <FormRow>
                <Field invalid={errors.face_value !== undefined} required>
                  <FieldLabel>{t("terms.faceValue")}</FieldLabel>
                  <MoneyInput
                    size="field"
                    value={draft.face}
                    onChange={(face) => {
                      change({ face });
                    }}
                    currency={quote}
                    scale={scale}
                    sign="neutral"
                  />
                  {errors.face_value !== undefined && (
                    <FieldError>{errors.face_value}</FieldError>
                  )}
                </Field>

                <Field invalid={errors.day_count !== undefined} required>
                  <FieldLabel>{t("terms.dayCount")}</FieldLabel>
                  <ChoiceSelect
                    label={t("terms.dayCount")}
                    choices={dayCountChoices}
                    value={draft.dayCount}
                    multiple={false}
                    invalid={errors.day_count !== undefined}
                    onChange={(next) => {
                      if (typeof next === "string")
                        change({ dayCount: next as DayCount });
                    }}
                  />
                  {errors.day_count !== undefined && (
                    <FieldError>{errors.day_count}</FieldError>
                  )}
                </Field>
              </FormRow>

              <TermsRateFields
                draft={draft}
                errors={errors}
                onChange={change}
              />
            </FormLayout>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {t("terms.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
