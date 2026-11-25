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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import type { SyntheticEvent } from "react";

import type { components } from "@/api/schema.gen";
import { ChangeEffectLine } from "@/features/portfolio/projection/contributions-block/change-effect-line";
import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import { useChangeDialog } from "@/features/portfolio/projection/contributions-block/use-change-dialog";
import type { EditTarget } from "@/features/portfolio/projection/contributions-block/use-contribution-edit";
import type { ProjectInput } from "@/features/portfolio/projection/model/project";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { MoneyInput } from "@/ui/money/money-input";
import { MonthControl } from "@/ui/navigation/month-control";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

interface ChangeDialogProps {
  target: EditTarget;
  others: readonly components["schemas"]["ProjectionChange"][];
  current: string;
  base: Omit<ProjectInput, "changes">;
  age: number;
  currency: string;
  scale: number;
  removable: boolean;
  onSave: (change: components["schemas"]["ProjectionChange"]) => void;
  onRemove: () => void;
  onCancel: () => void;
}

// PX9: one change in a small dialog; "Remover mudança" stands at the start side, "Cancelar" and
// "Salvar" at the end.
export function ChangeDialog({
  target,
  others,
  current,
  base,
  age,
  currency,
  scale,
  removable,
  onSave,
  onRemove,
  onCancel,
}: ChangeDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const form = useChangeDialog({ target, others, current, base, onSave });
  const handleOpen = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    form.submit();
  }

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={handleOpen}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("portfolio.projection.contributions.dialog")}
            </DialogTitle>

            <DialogDescription>
              {t("portfolio.projection.contributions.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className={styles.stepForm}>
              <Field necessity="none" invalid={form.error !== null}>
                <FieldLabel>
                  {t("portfolio.projection.contributions.field.month")}
                </FieldLabel>

                <MonthControl
                  label={t("portfolio.projection.contributions.field.month")}
                  value={form.month}
                  onChange={form.setMonth}
                />

                {form.error !== null && (
                  <FieldError>
                    {t(
                      `portfolio.projection.contributions.error.${form.error}`,
                    )}
                  </FieldError>
                )}
              </Field>

              <Field necessity="none">
                <FieldLabel>
                  {t("portfolio.projection.contributions.field.amount")}
                </FieldLabel>

                <MoneyInput
                  size="field"
                  value={form.amount}
                  onChange={form.setAmount}
                  currency={currency}
                  scale={scale}
                  sign="neutral"
                />

                <FieldDescription>
                  {t("portfolio.projection.contributions.field.amountHint")}
                </FieldDescription>
              </Field>

              {form.effect !== null && (
                <ChangeEffectLine
                  effect={form.effect}
                  age={age}
                  currency={currency}
                  scale={scale}
                />
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <div className={styles.stepFoot}>
              {removable ? (
                <Button
                  type="button"
                  variant="ghost"
                  tone="danger"
                  onClick={onRemove}
                >
                  {t("portfolio.projection.contributions.remove")}
                </Button>
              ) : (
                <span />
              )}

              <span className={styles.stepFootEnd}>
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
