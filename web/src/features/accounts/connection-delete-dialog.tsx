import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteConnection } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

type Connection = components["schemas"]["Connection"];

// Deleting a connection removes its mappings; what it imported stays in the ledger.
export function ConnectionDeleteDialog({
  connection,
  onClose,
}: {
  connection: Connection;
  onClose: () => void;
}) {
  const t = useT();
  const remove = useDeleteConnection();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    remove
      .mutateAsync(connection.id)
      .then(onClose)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("links.deleteTitle", { name: connection.name })}
      description={t("links.deleteHint")}
      confirmLabel={t("links.deleteConfirm")}
      pending={remove.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
