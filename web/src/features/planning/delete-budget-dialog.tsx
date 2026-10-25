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
import { InlineMessage } from "@slotted/react/inline-message";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteBudget } from "@/features/planning/api";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// Deleting a budget removes it with its amounts and leaves the category and its transactions;
// the dialog says so before the reader confirms (S144).
export function DeleteBudgetDialog({
  budget,
  name,
  onDone,
  onCancel,
}: {
  budget: components["schemas"]["Budget"];
  // The category the budget is for, as the month view names it.
  name: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const remove = useDeleteBudget();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog
      open={overlayOpen}
      size="sm"
      fullScreen="never"
      onOpenChange={change}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("budget.deleteTitle", { name })}</DialogTitle>
          <DialogDescription>{t("budget.deleteHint")}</DialogDescription>
        </DialogHeader>
        {error !== null && (
          <DialogBody>
            <InlineMessage tone="danger">{error}</InlineMessage>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={remove.isPending}
            onClick={() => {
              setError(null);
              remove
                .mutateAsync(budget.id)
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("budget.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
