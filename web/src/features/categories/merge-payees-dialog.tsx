import { Button } from "@slotted/react/button";
import {
  AlertDialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useMergePayees } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

type Payee = components["schemas"]["Payee"];

// The selected payees become one: the reader chooses which name stays.
export function MergePayeesDialog({
  payees,
  onDone,
  onCancel,
}: {
  payees: readonly Payee[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const merge = useMergePayees();
  const [into, setInto] = useState(payees[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <AlertDialog open onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("payees.mergeTitle", { count: payees.length })}
          </DialogTitle>
          <DialogDescription>{t("payees.mergeDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Stack gap={4}>
            <RadioGroup
              aria-label={t("payees.keep")}
              value={into}
              onValueChange={(value) => {
                if (typeof value === "string") setInto(value);
              }}
            >
              {payees.map((payee) => (
                <Radio key={payee.id} value={payee.id}>
                  {payee.name}
                </Radio>
              ))}
            </RadioGroup>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={merge.isPending}
            onClick={() => {
              setError(null);
              merge
                .mutateAsync({
                  sources: payees.map((p) => p.id).filter((id) => id !== into),
                  into,
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("payees.merge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
