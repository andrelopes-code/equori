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
import { usePauseSchedule } from "@/features/planning/api";
import { shiftDate } from "@/i18n/format";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import widths from "@/ui/field-width.module.css";
import { FormLayout } from "@/ui/form-layout";
import { FormRow } from "@/ui/form-row";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Schedule = components["schemas"]["Schedule"];

// A pause range, both ends included; the server refuses one that overlaps another pause.
export function PauseDialog({
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
  const today = useToday();
  const overlayOpen = useOverlayOpen();
  const pause = usePauseSchedule();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(shiftDate(today, 30));
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="md" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("schedule.pauseTitle", { name })}</DialogTitle>
          <DialogDescription>{t("schedule.pauseHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormLayout>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}

            <FormRow>
              <Field required>
                <FieldLabel>{t("schedule.pauseFrom")}</FieldLabel>
                <DateInput
                  className={widths.fill}
                  name="from"
                  value={from}
                  shortcuts={false}
                  onChange={(next) => {
                    setFrom(next);
                    if (to < next) setTo(next);
                  }}
                />
              </Field>

              <Field required>
                <FieldLabel>{t("schedule.pauseTo")}</FieldLabel>
                <DateInput
                  className={widths.fill}
                  name="to"
                  value={to}
                  min={from}
                  shortcuts={false}
                  onChange={setTo}
                />
              </Field>
            </FormRow>
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={pause.isPending}
            onClick={() => {
              setError(null);
              pause
                .mutateAsync({ id: schedule.id, pause: { from, to } })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("schedule.pause")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
