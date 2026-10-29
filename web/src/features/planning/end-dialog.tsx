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
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useEndSchedule } from "@/features/planning/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { FormLayout } from "@/ui/form-layout";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

// Ending a schedule removes its expected occurrences from the date on and keeps the realized
// ones; the dialog says so, for the date chosen, before the reader confirms.
export function EndDialog({
  schedule,
  name,
  onDone,
  onCancel,
}: {
  schedule: Schedule;
  name: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const overlayOpen = useOverlayOpen();
  const end = useEndSchedule();
  const [from, setFrom] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.endTitle", { name })}</DialogTitle>
          <DialogDescription>
            {t("schedule.endHint", { date: formatDate(from, locale) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormLayout>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}

            <Field required>
              <FieldLabel>{t("schedule.endFrom")}</FieldLabel>
              <DateInput
                name="from"
                value={from}
                shortcuts={false}
                onChange={setFrom}
              />
            </Field>
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={end.isPending}
            onClick={() => {
              setError(null);
              end
                .mutateAsync({ id: schedule.id, from })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("schedule.end")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
