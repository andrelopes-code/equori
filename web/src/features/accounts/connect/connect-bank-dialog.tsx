import { Dialog, DialogBody, DialogContent } from "@slotted/react/dialog";
import { SkeletonText } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { ConnectBankDone } from "@/features/accounts/connect/connect-bank-done";
import { ConnectBankForm } from "@/features/accounts/connect/connect-bank-form";
import { ConnectBankSetup } from "@/features/accounts/connect/connect-bank-setup";
import { useConnectBank } from "@/features/accounts/connect/use-connect-bank";
import { integrationsQuery } from "@/features/setup";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { QueryError } from "@/ui/feedback/query-error";

interface ConnectBankDialogProps {
  // The integration to connect through, or "new" for the first one.
  initial: string;
  onClose: () => void;
}

// The dialog closes while the aggregator's own stands: a modal dialog makes the rest of the page
// inert, and the aggregator's is drawn in it.
export function ConnectBankDialog({
  initial,
  onClose,
}: ConnectBankDialogProps) {
  const overlayOpen = useOverlayOpen();
  const integrations = useQuery(integrationsQuery(useApi()));
  const connect = useConnectBank();

  const items = integrations.data ?? [];
  const connection = connect.connection;

  return (
    <Dialog
      open={overlayOpen && !connect.launching}
      size="md"
      onOpenChange={(open) => {
        if (!open && !connect.launching) onClose();
      }}
    >
      <DialogContent>
        {integrations.isPending && (
          <DialogBody>
            <SkeletonText lines={4} />
          </DialogBody>
        )}

        {integrations.isError && (
          <DialogBody>
            <QueryError
              error={integrations.error}
              onRetry={() => void integrations.refetch()}
            />
          </DialogBody>
        )}

        {integrations.isSuccess && items.length === 0 && (
          <ConnectBankSetup onClose={onClose} />
        )}

        {items.length > 0 && connection === null && (
          <ConnectBankForm
            integrations={items}
            initial={initial}
            connect={connect}
            onClose={onClose}
          />
        )}

        {connection !== null && (
          <ConnectBankDone connection={connection} onAnother={connect.reset} />
        )}
      </DialogContent>
    </Dialog>
  );
}
