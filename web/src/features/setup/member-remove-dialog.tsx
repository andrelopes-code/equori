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
import { useRemoveMember } from "@/features/setup/api";
import type { BooksMember } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

interface MemberRemoveDialogProps {
  member: BooksMember;
  onClose: () => void;
}

// Removing a member also deletes their sessions, access tokens and conversations in the book (HA22).
export function MemberRemoveDialog({
  member,
  onClose,
}: MemberRemoveDialogProps) {
  const t = useT();
  const remove = useRemoveMember();
  const [failure, setFailure] = useState<unknown>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("members.removeTitle", { email: member.email })}
          </DialogTitle>
          <DialogDescription>{t("members.removeHint")}</DialogDescription>
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
            loading={remove.isPending}
            onClick={() => {
              setFailure(null);
              remove
                .mutateAsync(member.member_id)
                .then(onClose)
                .catch((caught: unknown) => {
                  setFailure(caught);
                });
            }}
          >
            {t("members.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
