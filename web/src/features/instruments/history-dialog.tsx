import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { useRequestHistory } from "@/features/instruments/api";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { FormLayout } from "@/ui/form-layout";
import { FormNotice } from "@/ui/form-notice";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

interface HistoryDialogProps {
  code: string;
  onDone: () => void;
  onCancel: () => void;
}

// Asks the enabled sources for the prices since a date; twenty years back by default.
export function HistoryDialog({ code, onDone, onCancel }: HistoryDialogProps) {
  const t = useT();
  const today = useToday();
  const overlayOpen = useOverlayOpen();
  const request = useRequestHistory();
  const [from, setFrom] = useState(shiftDate(today, -7305));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleSubmit() {
    setSummary(null);
    request
      .mutateAsync({ code, from })
      .then(onDone)
      .catch((caught: unknown) => {
        const fields =
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {};
        setErrors(fields);
        setSummary(
          Object.keys(fields).length > 0 ? null : errorText(caught, t),
        );
      });
  }

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={openChange}>
      <DialogContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("instruments.history.title")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormLayout>
              {summary !== null && <FormNotice>{summary}</FormNotice>}
              <Field invalid={errors.from !== undefined} required>
                <FieldLabel>{t("instruments.history.from")}</FieldLabel>
                <DateInput name="from" value={from} onChange={setFrom} />
                {errors.from !== undefined && (
                  <FieldError>{errors.from}</FieldError>
                )}
              </Field>
            </FormLayout>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("instruments.history.cancel")}
            </Button>
            <Button type="submit" loading={request.isPending}>
              {t("instruments.history.send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
