import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

// Asked when the reader leaves the month, the view or the page with changes not saved.
export function PlanDiscardDialog({
  pending,
  month,
  onKeep,
  onDiscard,
}: {
  pending: number;
  month: string;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const t = useT();
  const change = useStableCallback((open: boolean) => {
    if (!open) onKeep();
  });
  return (
    <Dialog open size="sm" fullScreen="never" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pending === 1
              ? t("plan.discardTitleOne")
              : t("plan.discardTitle", { count: String(pending) })}
          </DialogTitle>
          <DialogDescription>
            {t("plan.discardBody", { month })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onKeep}>
            {t("plan.keepEditing")}
          </Button>
          <Button tone="danger" onClick={onDiscard}>
            {t("plan.discard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
