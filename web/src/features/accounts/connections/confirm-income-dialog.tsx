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

import type { components } from "@/api/schema.gen";
import { CategoryPicker } from "@/features/categories";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { FieldTitle } from "@/ui/form-fields/field-title";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { MoneyInput } from "@/ui/money/money-input";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Movement = components["schemas"]["InvestmentMovement"];

interface ConfirmIncomeDialogProps {
  movement: Movement;
  onConfirm: (categoryId: string, withheld: number) => void;
  onCancel: () => void;
}

// The income category of an interest and the tax withheld from the gross the institution states.
export function ConfirmIncomeDialog({
  movement,
  onConfirm,
  onCancel,
}: ConfirmIncomeDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const scale = useScale();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [withheld, setWithheld] = useState(0);

  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  const { amount, currency } = movement.amount;
  const tooHigh = withheld > 0 && withheld >= Math.abs(amount);

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("connection.investments.incomeTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FormLayout fill>
            <Field required>
              <FieldLabel>{t("connection.investments.category")}</FieldLabel>
              <CategoryPicker
                placeholder={t("entry.categoryPlaceholder")}
                value={categoryId}
                amount={1}
                onChange={setCategoryId}
              />
            </Field>

            <Field invalid={tooHigh}>
              <FieldTitle
                label={t("income.withheld")}
                help={t("income.withheldHelp")}
              />
              <MoneyInput
                size="field"
                value={withheld}
                currency={currency}
                scale={(scale ?? (() => 2))(currency)}
                sign="neutral"
                onChange={setWithheld}
              />
              {tooHigh && (
                <FieldError>{t("income.withheldTooHigh")}</FieldError>
              )}
            </Field>
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            disabled={categoryId === null || tooHigh}
            onClick={() => {
              if (categoryId !== null) onConfirm(categoryId, withheld);
            }}
          >
            {t("connection.investments.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
