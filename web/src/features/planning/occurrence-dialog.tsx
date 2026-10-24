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
import { Stack } from "@slotted/react/stack";
import { Textarea } from "@slotted/react/textarea";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { OccurrenceRef } from "@/features/planning/agenda";
import {
  useMoveOccurrence,
  useSkipOccurrence,
  useUnrealizeOccurrence,
} from "@/features/planning/api";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

export type OccurrenceChange = "skip" | "move" | "unrealize";

// Skip, move and unrealize: one confirmation each, with the Problem of a refusal in place.
export function OccurrenceDialog({
  change,
  occurrence,
  name,
  onDone,
  onCancel,
}: {
  change: OccurrenceChange;
  occurrence: OccurrenceRef;
  name: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const formId = useId();
  const overlayOpen = useOverlayOpen();
  const skip = useSkipOccurrence();
  const move = useMoveOccurrence();
  const unrealize = useUnrealizeOccurrence();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(occurrence.expected_on);
  const [error, setError] = useState<string | null>(null);
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const write = () => {
    switch (change) {
      case "skip":
        return skip.mutateAsync({ id: occurrence.id, reason: reason.trim() });
      case "move":
        return move.mutateAsync({ id: occurrence.id, date });
      case "unrealize":
        return unrealize.mutateAsync(occurrence.id);
    }
  };
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`occurrence.${change}Title`, { name })}</DialogTitle>
          <DialogDescription>{t(`occurrence.${change}Hint`)}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              write()
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <Stack gap={4}>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}
              {change === "skip" && (
                <Field>
                  <FieldLabel>{t("occurrence.reason")}</FieldLabel>
                  <Textarea
                    name="reason"
                    maxLength={200}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                    }}
                  />
                </Field>
              )}
              {change === "move" && (
                <Field required>
                  <FieldLabel>{t("occurrence.date")}</FieldLabel>
                  <DateInput name="date" value={date} onChange={setDate} />
                </Field>
              )}
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            {...(change === "move" ? {} : { tone: "danger" as const })}
            loading={skip.isPending || move.isPending || unrealize.isPending}
          >
            {t(`occurrence.${change}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
