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
import type { components } from "@/api/schema.gen";
import { useReopenAccount } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Account = components["schemas"]["Account"];

// A74: reopening an account reopens its closed ancestors; the dialog names them first.
export function ReopenAccountDialog({
  account,
  ancestors,
  onDone,
  onCancel,
}: {
  account: Account;
  ancestors: Account[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const reopen = useReopenAccount();
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const closed = ancestors.filter((a) => a.closed_on !== undefined);
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("account.reopenTitle", { name: account.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Stack gap={3}>
            <Text size="sm">
              {closed.length === 0
                ? t("account.reopenAlone")
                : t("account.reopenAncestors", {
                    names: closed.map((a) => a.name).join(", "),
                  })}
            </Text>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={reopen.isPending}
            onClick={() => {
              setError(null);
              reopen
                .mutateAsync(account.id)
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("account.reopenConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
