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
import type { Goal } from "@/features/goals/goal-line";
import { useDeleteGoal } from "@/features/planning";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

// Deleting a goal removes only the goal; the dialog says so before the reader confirms.
export function DeleteGoalDialog({
  goal,
  onDone,
  onCancel,
}: {
  goal: Goal;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const remove = useDeleteGoal();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("goals.deleteTitle", { name: goal.name })}
          </DialogTitle>
          <DialogDescription>{t("goals.deleteHint")}</DialogDescription>
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
                .mutateAsync(goal.id)
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("goals.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
