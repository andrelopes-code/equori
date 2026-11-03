import { useState } from "react";

import { errorText } from "@/api/problem";
import { useDeleteAccessToken } from "@/features/setup/api";
import type { AccessToken } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// Deleting a token takes effect at the client's next request (X9).
export function AccessTokenDeleteDialog({
  token,
  onClose,
}: {
  token: AccessToken;
  onClose: () => void;
}) {
  const t = useT();
  const remove = useDeleteAccessToken();
  const [failure, setFailure] = useState<unknown>(null);

  function handleConfirm() {
    setFailure(null);
    remove
      .mutateAsync(token.id)
      .then(onClose)
      .catch((caught: unknown) => {
        setFailure(caught);
      });
  }

  return (
    <ConfirmDialog
      title={t("settings.external_access.deleteTitle", { name: token.name })}
      description={t("settings.external_access.deleteHint")}
      confirmLabel={t("settings.external_access.delete")}
      pending={remove.isPending}
      error={failure === null ? null : errorText(failure, t)}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
