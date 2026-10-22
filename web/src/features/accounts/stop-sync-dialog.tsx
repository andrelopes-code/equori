import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { Linked } from "@/features/accounts/account-tab-panel";
import { useMapExternalAccount } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

// Ignoring the external account leaves it out of every sync; what it imported stays (A35).
export function StopSyncDialog({
  linked,
  onDone,
}: {
  linked: Linked;
  onDone: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const map = useMapExternalAccount();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onDone();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("sync.stopTitle", { name: linked.external.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap={3}>
            <Text size="sm">{t("sync.stopHint")}</Text>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onDone}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={map.isPending}
            onClick={() => {
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
            }}
          >
            {t("sync.stopConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
