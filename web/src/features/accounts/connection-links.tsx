import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Heading } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useSyncConnection } from "@/features/accounts/api";
import { ConnectionAccountsTable } from "@/features/accounts/connection-accounts-table";
import type { ConnectionMessage } from "@/features/accounts/connection-account-actions";
import { ConnectionBatches } from "@/features/accounts/connection-batches";
import { ConnectionDeleteDialog } from "@/features/accounts/connection-delete-dialog";
import { ConnectionSyncs } from "@/features/accounts/connection-syncs";
import { ConnectionStateAlert } from "@/features/accounts/connection-state-alert";
import { ConnectionTimesList } from "@/features/accounts/connection-times-list";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];
type ExternalAccount = components["schemas"]["ExternalAccount"];
type ImportBatch = components["schemas"]["ImportBatch"];

const stateTones = {
  ok: "success",
  needs_owner: "warning",
  failed: "danger",
  stalled: "warning",
  consent_expiring: "warning",
} as const;

const providerWords: Record<string, MessageKey> = {
  UPDATED: "sync.provider.UPDATED",
  UPDATING: "sync.provider.UPDATING",
  LOGIN_ERROR: "sync.provider.LOGIN_ERROR",
  OUTDATED: "sync.provider.OUTDATED",
  WAITING_USER_INPUT: "sync.provider.WAITING_USER_INPUT",
};

interface ConnectionLinksProps {
  connection: Connection;
  accounts: Map<string, Account>;
  onLink: (external: ExternalAccount) => void;
}

// One connection: its provider's state, a sync on demand, and each account it brings with the
// ledger account that account feeds.
export function ConnectionLinks({
  connection,
  accounts,
  onLink,
}: ConnectionLinksProps) {
  const t = useT();
  const sync = useSyncConnection();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<ConnectionMessage | null>(null);

  const provider = providerWords[connection.provider_status];
  const portal = connection.portal ?? t("sync.portal.none");

  return (
    <Stack
      gap={8}
      render={(props) => <section {...props} aria-label={connection.name} />}
    >
      <Inline justify="between" gap={4}>
        <Stack gap={0}>
          <Inline gap={4} align="center">
            <Heading level={2} size="md">
              {connection.name}
            </Heading>
            <Tag size="sm" tone={stateTones[connection.state]}>
              {t(`links.connectionState.${connection.state}`)}
            </Tag>
            <Tag size="sm" tone="secondary">
              {provider === undefined
                ? connection.provider_status
                : t(provider, { portal })}
            </Tag>
          </Inline>
        </Stack>
        <Inline gap={2}>
          <Button
            variant="ghost"
            tone="danger"
            aria-label={t("links.deleteOf", { name: connection.name })}
            onClick={() => {
              setDeleting(true);
            }}
          >
            {t("links.deleteConfirm")}
          </Button>
          <Button
            variant="outline"
            loading={sync.isPending}
            aria-label={t("links.syncOf", { name: connection.name })}
            onClick={() => {
              setMessage(null);
              setBatches([]);
              sync
                .mutateAsync(connection.id)
                .then((answer) => {
                  setBatches(answer.batches);
                  setMessage({
                    tone: "success",
                    text:
                      answer.batches.length === 0
                        ? t("sync.notSynced", { portal })
                        : t("links.synced", { count: answer.batches.length }),
                  });
                })
                .catch((caught: unknown) => {
                  setMessage({ tone: "danger", text: errorText(caught, t) });
                });
            }}
          >
            {t("sync.now")}
          </Button>
        </Inline>
      </Inline>
      <ConnectionTimesList connection={connection} />
      <ConnectionStateAlert connection={connection} />
      {(message !== null || connection.last_error !== undefined) && (
        <Alert tone={message?.tone ?? "danger"} live="polite">
          <AlertContent>
            <AlertDescription>
              {message?.text ??
                t("sync.lastError", { error: connection.last_error ?? "" })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <ConnectionBatches batches={batches} accounts={accounts} />
      <Presence value={deleting ? connection : undefined}>
        {(target) => (
          <ConnectionDeleteDialog
            connection={target}
            onClose={() => {
              setDeleting(false);
            }}
          />
        )}
      </Presence>
      <ConnectionAccountsTable
        connection={connection}
        accounts={accounts}
        onLink={onLink}
        onMessage={setMessage}
      />
      <ConnectionSyncs connection={connection} accounts={accounts} />
    </Stack>
  );
}
