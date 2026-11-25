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
import type { SyntheticEvent } from "react";

import { IncomeFields } from "@/features/portfolio/projection/incomes-block/income-fields";
import styles from "@/features/portfolio/projection/incomes-block/incomes-block.module.css";
import { useIncomeDialog } from "@/features/portfolio/projection/incomes-block/use-income-dialog";
import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface IncomeDialogProps {
  income: OtherIncome | null;
  currency: string;
  scale: number;
  onSave: (income: OtherIncome) => void;
  onRemove: () => void;
  onCancel: () => void;
}

// PX21: one income in a small dialog; "Remover renda" stands at the start side, "Cancelar" and
// "Salvar" at the end.
export function IncomeDialog({
  income,
  currency,
  scale,
  onSave,
  onRemove,
  onCancel,
}: IncomeDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const state = useIncomeDialog(income, onSave);
  const handleOpen = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    state.submit();
  }

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={handleOpen}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("portfolio.projection.incomes.dialog")}
            </DialogTitle>

            <DialogDescription>
              {t("portfolio.projection.incomes.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <IncomeFields state={state} currency={currency} scale={scale} />
          </DialogBody>

          <DialogFooter>
            <div className={styles.foot}>
              {income === null ? (
                <span />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  tone="danger"
                  onClick={onRemove}
                >
                  {t("portfolio.projection.incomes.remove")}
                </Button>
              )}

              <span className={styles.footEnd}>
                <Button variant="ghost" tone="secondary" onClick={onCancel}>
                  {t("portfolio.projection.contributions.cancel")}
                </Button>

                <Button type="submit">
                  {t("portfolio.projection.contributions.save")}
                </Button>
              </span>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
