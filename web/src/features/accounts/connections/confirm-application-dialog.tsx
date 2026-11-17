import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field } from "@slotted/react/field";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { AccountField, useBrokerages } from "@/features/transactions";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Movement = components["schemas"]["InvestmentMovement"];

interface ConfirmApplicationDialogProps {
  movement: Movement;
  onConfirm: (brokerageId: string) => void;
  onCancel: () => void;
}

// The brokerage that holds a new application: the one field the confirmation needs.
export function ConfirmApplicationDialog({
  movement,
  onConfirm,
  onCancel,
}: ConfirmApplicationDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const scale = useScale();
  const [brokerageId, setBrokerageId] = useState<string | null>(null);
  const { brokerages } = useBrokerages(brokerageId, null);

  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("connection.investments.confirmTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FormLayout fill>
            <Field required>
              <FieldTitle label={t("connection.investments.brokerage")} />
              <AccountField
                compact
                name="brokerage"
                title={t("connection.investments.brokerage")}
                context={t("connection.investments.brokerage")}
                accounts={brokerages}
                value={brokerageId}
                exclude={null}
                amount={0}
                direction="in"
                date={movement.date}
                categoryId={null}
                payeeId={null}
                kind="transfer"
                currency={movement.amount.currency}
                scale={scale ?? (() => 2)}
                onChange={setBrokerageId}
              />
            </Field>
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            disabled={brokerageId === null}
            onClick={() => {
              if (brokerageId !== null) onConfirm(brokerageId);
            }}
          >
            {t("connection.investments.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
