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
import { InlineMessage } from "@slotted/react/inline-message";
import { TextField } from "@slotted/react/text-field";
import { useId, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useRecordPrice } from "@/features/instruments/api";
import { parseRate } from "@/features/instruments/rate";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// Records the price of one date. The server replaces a manual price of the same date, and the
// form says so before the write.
export function RecordPriceDialog({
  instrument,
  quote,
  onDone,
  onCancel,
}: {
  instrument: string;
  quote: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const today = useToday();
  const formId = useId();
  const overlayOpen = useOverlayOpen();
  const record = useRecordPrice();
  const subject = `${instrument} · ${quote}`;
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const submit = () => {
    const value = parseRate(text);
    setSummary(null);
    if (value === null) {
      setErrors({ value: t("instrument.price.invalid") });
      return;
    }
    setErrors({});
    record
      .mutateAsync({ instrument, quote_instrument: quote, date, value })
      .then(onDone)
      .catch((caught: unknown) => {
        const fields =
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {};
        setErrors(fields);
        setSummary(
          Object.keys(fields).length > 0 ? null : errorText(caught, t),
        );
      });
  };
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("instrument.price.title")}</DialogTitle>
          <DialogDescription>{subject}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <FormLayout>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}
              <Alert tone="info">
                <AlertContent>
                  <AlertDescription>
                    {t("instrument.price.replaceNote")}
                  </AlertDescription>
                </AlertContent>
              </Alert>
              <Field invalid={errors.date !== undefined} required>
                <FieldLabel>{t("instrument.price.date")}</FieldLabel>
                <DateInput name="date" value={date} onChange={setDate} />
                {errors.date !== undefined && (
                  <FieldError>{errors.date}</FieldError>
                )}
              </Field>

              <Field invalid={errors.value !== undefined} required>
                <FieldLabel>{t("instrument.price.value")}</FieldLabel>
                <TextField
                  className={widths.medium}
                  name="value"
                  inputMode="decimal"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                  }}
                />
                {errors.value !== undefined && (
                  <FieldError>{errors.value}</FieldError>
                )}
              </Field>
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={record.isPending}>
            {t("instrument.price.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
