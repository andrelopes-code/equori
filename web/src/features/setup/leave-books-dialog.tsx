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
import { useLeaveBooks } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

interface LeaveBooksDialogProps {
  onClose: () => void;
}

// A successful leave reloads the page (useLeaveBooks), so the dialog closes only on a refusal.
export function LeaveBooksDialog({ onClose }: LeaveBooksDialogProps) {
  const t = useT();
  const leave = useLeaveBooks();
  const [failure, setFailure] = useState<unknown>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("members.leaveTitle")}</DialogTitle>
          <DialogDescription>{t("members.leaveHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {failure !== null && (
            <InlineMessage tone="danger">{errorText(failure, t)}</InlineMessage>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={leave.isPending}
            onClick={() => {
              setFailure(null);
              leave.mutateAsync().catch((caught: unknown) => {
                setFailure(caught);
              });
            }}
          >
            {t("members.leave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
