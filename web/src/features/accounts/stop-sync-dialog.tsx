import { useState } from "react";

import { errorText } from "@/api/problem";
import type { Linked } from "@/features/accounts/account-tab-panel";
import { useMapExternalAccount } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// Ignoring the external account leaves it out of every sync; what it imported stays (A35).
export function StopSyncDialog({
  linked,
  onDone,
}: {
  linked: Linked;
  onDone: () => void;
}) {
  const t = useT();
  const map = useMapExternalAccount();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    map
      .mutateAsync({
        connectionId: linked.connection.id,
        externalId: linked.external.id,
        mapping: { ignored: true },
      })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("sync.stopTitle", { name: linked.external.name })}
      description={t("sync.stopHint")}
      confirmLabel={t("sync.stopConfirm")}
      pending={map.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onDone}
    />
  );
}
