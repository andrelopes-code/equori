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
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";
import { useId, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useOpenDispute, useResolveDispute } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type StatementPosting = components["schemas"]["StatementPosting"];
type Dispute = components["schemas"]["Dispute"];

// M22: a purchase disputed with the bank, then resolved; a won dispute refunds what remained
// charged on the statement chosen.
export function DisputeDialog({
  line,
  open,
  onDone,
  onCancel,
}: {
  line: StatementPosting;
  // The dispute still open on the purchase; absent, the dialog opens one.
  open: Dispute | undefined;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const today = useToday();
  const formId = useId();
  const start = useOpenDispute();
  const resolve = useResolveDispute();
  const [date, setDate] = useState(today);
  const [outcome, setOutcome] = useState<"won" | "lost" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((isOpen: boolean) => {
    if (!isOpen) onCancel();
  });
  const resolving = open !== undefined;
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(resolving ? "dispute.resolveTitle" : "dispute.openTitle", {
              name: line.description,
            })}
          </DialogTitle>
          <DialogDescription>
            {t(resolving ? "dispute.resolveHint" : "dispute.openHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const request = resolving
                ? outcome === null
                  ? null
                  : resolve.mutateAsync({
                      id: open.id,
                      body: { resolved_on: date, outcome },
                    })
                : start.mutateAsync({
                    transactionId: line.transaction_id,
                    openedOn: date,
                  });
              request?.then(onDone).catch((caught: unknown) => {
                setError(errorText(caught, t));
              });
            }}
          >
            <Stack gap={4}>
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}
              {resolving && (
                <Field>
                  <FieldLabel>{t("dispute.outcome")}</FieldLabel>
                  <RadioGroup
                    name="outcome"
                    value={outcome ?? ""}
                    onValueChange={(value) => {
                      if (value === "won" || value === "lost")
                        setOutcome(value);
                    }}
                  >
                    <Radio value="won" description={t("dispute.wonHint")}>
                      {t("dispute.won")}
                    </Radio>
                    <Radio value="lost" description={t("dispute.lostHint")}>
                      {t("dispute.lost")}
                    </Radio>
                  </RadioGroup>
                </Field>
              )}
              <Field>
                <FieldLabel>
                  {t(resolving ? "dispute.resolvedOn" : "dispute.openedOn")}
                </FieldLabel>
                <DateInput name="date" value={date} onChange={setDate} />
              </Field>
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
            disabled={resolving && outcome === null}
            loading={start.isPending || resolve.isPending}
          >
            {t(resolving ? "dispute.resolveSubmit" : "dispute.openSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
