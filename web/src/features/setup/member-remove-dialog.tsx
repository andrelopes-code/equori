import { useState } from "react";

import { errorText } from "@/api/problem";
import { useRemoveMember } from "@/features/setup/api";
import type { BooksMember } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

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

  function handleConfirm() {
    setFailure(null);
    remove
      .mutateAsync(member.member_id)
      .then(onClose)
      .catch((caught: unknown) => {
        setFailure(caught);
      });
  }

  return (
    <ConfirmDialog
      title={t("members.removeTitle", { email: member.email })}
      description={t("members.removeHint")}
      confirmLabel={t("members.remove")}
      pending={remove.isPending}
      error={failure === null ? null : errorText(failure, t)}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
