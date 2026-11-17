import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldLabel } from "@slotted/react/field";
import { useState } from "react";

import { CategoryPicker } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface ConfirmIncomeDialogProps {
  onConfirm: (categoryId: string) => void;
  onCancel: () => void;
}

// The income category of an interest: the one field the confirmation needs.
export function ConfirmIncomeDialog({
  onConfirm,
  onCancel,
}: ConfirmIncomeDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

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
          </FormLayout>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            disabled={categoryId === null}
            onClick={() => {
              if (categoryId !== null) onConfirm(categoryId);
            }}
          >
            {t("connection.investments.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
