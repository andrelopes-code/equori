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
import type { components } from "@/api/schema.gen";
import { useDeleteConnection } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

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
  const overlayOpen = useOverlayOpen();
  const remove = useDeleteConnection();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("links.deleteTitle", { name: connection.name })}
          </DialogTitle>
          <DialogDescription>{t("links.deleteHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {error !== null && (
            <InlineMessage tone="danger">{error}</InlineMessage>
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
              setError(null);
              remove
                .mutateAsync(connection.id)
                .then(onClose)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("links.deleteConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
