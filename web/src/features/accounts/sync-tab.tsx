import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Grid } from "@slotted/react/grid";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { Linked } from "@/features/accounts/account-tab-panel";
import { StopSyncDialog } from "@/features/accounts/stop-sync-dialog";
import { SyncFreshnessCard } from "@/features/accounts/sync-freshness-card";
import { SyncSourceCard } from "@/features/accounts/sync-source-card";
import { SyncStartDialog } from "@/features/accounts/sync-start-dialog";
import { useSyncNow } from "@/features/accounts/use-sync-now";
import { useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

interface SyncTabProps {
  account: Account;
  linked: Linked;
}

// The Open Finance account that feeds this one: where it comes from, how fresh it is, and the
// three things the owner does with the link (A35, A43, A95).
export function SyncTab({ account, linked }: SyncTabProps) {
  const t = useT();
  const { connection } = linked;
  const portal = connection.portal ?? t("sync.portal.none");
  const sync = useSyncNow(account.id, portal);

  const [dialog, setDialog] = useState<"start" | "stop" | null>(null);

  return (
    <Stack gap={6}>
      <Inline justify="between" align="center" gap={3} wrap="wrap">
        <Text size="sm" role="status">
          {sync.result}
        </Text>
        <Inline gap={3}>
          <Button
            variant="ghost"
            tone="danger"
            onClick={() => {
              setDialog("stop");
            }}
          >
            {t("sync.stop")}
          </Button>
          <Button
            variant="outline"
            tone="secondary"
            onClick={() => {
              setDialog("start");
            }}
          >
            {t("sync.changeStart")}
          </Button>
          <Button
            loading={sync.pending}
            onClick={() => {
              sync.run(connection.id);
            }}
          >
            {t("sync.now")}
          </Button>
        </Inline>
      </Inline>

      {connection.last_error !== undefined && (
        <Alert tone="danger">
          <AlertContent>
            <AlertDescription>
              {t("sync.lastError", { error: connection.last_error })}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <Grid columns={2} gap={6}>
        <SyncSourceCard linked={linked} />
        <SyncFreshnessCard linked={linked} portal={portal} />
      </Grid>

      <Presence value={dialog === "start" ? dialog : undefined}>
        {() => (
          <SyncStartDialog
            account={account}
            linked={linked}
            onDone={() => {
              setDialog(null);
            }}
          />
        )}
      </Presence>
      <Presence value={dialog === "stop" ? dialog : undefined}>
        {() => (
          <StopSyncDialog
            linked={linked}
            onDone={() => {
              setDialog(null);
            }}
          />
        )}
      </Presence>
    </Stack>
  );
}
