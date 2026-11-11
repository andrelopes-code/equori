import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useDeleteCard } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

type Card = components["schemas"]["Card"];

export function DeleteCardDialog({
  card,
  onDone,
  onCancel,
}: {
  card: Card;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const remove = useDeleteCard();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    remove
      .mutateAsync(card.id)
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("card.removeTitle", { digits: card.last_four })}
      description={t("card.removeBody")}
      confirmLabel={t("card.remove")}
      pending={remove.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}
