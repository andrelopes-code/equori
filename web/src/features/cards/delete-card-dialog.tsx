import { Button } from "@slotted/react/button";
import {
  AlertDialog,
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
import type { components } from "@/api/schema.gen";
import { useDeleteCard } from "@/features/cards/api";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

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
  const overlayOpen = useOverlayOpen();
  const remove = useDeleteCard();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  return (
    <AlertDialog open={overlayOpen} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("card.removeTitle", { digits: card.last_four })}
          </DialogTitle>
          <DialogDescription>{t("card.removeBody")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error !== null && (
            <InlineMessage tone="danger">{error}</InlineMessage>
          )}
        </DialogBody>
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
                .mutateAsync(card.id)
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("card.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
