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
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { Linked } from "@/features/accounts/account-tab-panel";
import { useMapExternalAccount } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/date-input";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";

type Account = components["schemas"]["Account"];

// A35: the link is written again with a new first day to import.
export function SyncStartDialog({
  account,
  linked,
  onDone,
}: {
  account: Account;
  linked: Linked;
  onDone: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const map = useMapExternalAccount();
  const [from, setFrom] = useState(
    linked.external.sync_from ?? account.opened_on ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onDone();
  });
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("sync.changeStart")}</DialogTitle>
          <DialogDescription>{t("sync.changeStartHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field invalid={error !== null}>
            <FieldLabel>{t("sync.from")}</FieldLabel>
            <DateInput
              name="sync_from"
              value={from}
              onChange={setFrom}
              shortcuts={false}
            />
            {error !== null && <FieldError>{error}</FieldError>}
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onDone}>
            {t("detail.cancel")}
          </Button>
          <Button
            loading={map.isPending}
            onClick={() => {
              setError(null);
              map
                .mutateAsync({
                  connectionId: linked.connection.id,
                  externalId: linked.external.id,
                  mapping: { account_id: account.id, sync_from: from },
                })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            {t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
