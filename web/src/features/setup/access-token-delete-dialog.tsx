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
import { useDeleteAccessToken } from "@/features/setup/api";
import type { AccessToken } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";

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
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings.external_access.deleteTitle", { name: token.name })}
          </DialogTitle>
          <DialogDescription>
            {t("settings.external_access.deleteHint")}
          </DialogDescription>
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
                .mutateAsync(token.id)
                .then(onClose)
                .catch((caught: unknown) => {
                  setFailure(caught);
                });
            }}
          >
            {t("settings.external_access.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
