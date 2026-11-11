import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteInstitution } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

type Institution = components["schemas"]["Institution"];

export function DeleteInstitutionDialog({
  institution,
  onDone,
  onCancel,
}: {
  institution: Institution;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const remove = useDeleteInstitution();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    remove
      .mutateAsync(institution.id)
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("institutions.deleteTitle", { name: institution.name })}
      description={t("institutions.deleteBody")}
      confirmLabel={t("institutions.delete")}
      pending={remove.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}
