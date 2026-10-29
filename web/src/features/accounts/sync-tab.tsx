import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Card, CardBody } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import type { Linked } from "@/features/accounts/account-tab-panel";
import { useSyncConnection } from "@/features/accounts/api";
import { formatInstant } from "@/features/accounts/instant";
import { StopSyncDialog } from "@/features/accounts/stop-sync-dialog";
import { SyncStartDialog } from "@/features/accounts/sync-start-dialog";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { Presence } from "@/ui/presence";

type Account = components["schemas"]["Account"];

const providerWords: Record<string, MessageKey> = {
  UPDATED: "sync.provider.UPDATED",
  UPDATING: "sync.provider.UPDATING",
  LOGIN_ERROR: "sync.provider.LOGIN_ERROR",
  OUTDATED: "sync.provider.OUTDATED",
  WAITING_USER_INPUT: "sync.provider.WAITING_USER_INPUT",
};

export const subtypeWords: Record<string, MessageKey> = {
  CHECKING_ACCOUNT: "links.subtype.CHECKING_ACCOUNT",
  SAVINGS_ACCOUNT: "links.subtype.SAVINGS_ACCOUNT",
  CREDIT_CARD: "links.subtype.CREDIT_CARD",
  RESERVED_BALANCE: "links.subtype.RESERVED_BALANCE",
};

// The Open Finance account that feeds this one: where it comes from, how fresh it is, and the
// three things the owner does with the link (A35, A43, A95).
export function SyncTab({
  account,
  linked,
}: {
  account: Account;
  linked: Linked;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const sync = useSyncConnection();
  const [result, setResult] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"start" | "stop" | null>(null);
  const { connection, external } = linked;
  const provider = providerWords[connection.provider_status];
  const portal = connection.portal ?? t("sync.portal.none");
  const subtype = subtypeWords[external.subtype];
  return (
    <Card>
      <CardBody>
        <Stack gap={5}>
          <DescriptionList>
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.connection")}</DescriptionListTerm>
              <DescriptionListDescription>
                {connection.name}
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.external")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Stack gap={0}>
                  <Text size="sm">{external.name}</Text>
                  <Text size="xs" tone="muted">
                    {[
                      subtype === undefined ? external.subtype : t(subtype),
                      external.number_last4 === undefined
                        ? undefined
                        : t("account.lastFour", {
                            digits: external.number_last4,
                          }),
                    ]
                      .filter((p) => p !== undefined)
                      .join(" · ")}
                  </Text>
                </Stack>
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.status")}</DescriptionListTerm>
              <DescriptionListDescription>
                {provider === undefined
                  ? connection.provider_status
                  : t(provider, { portal })}
              </DescriptionListDescription>
            </DescriptionListItem>
            {external.sync_from !== undefined && (
              <DescriptionListItem>
                <DescriptionListTerm>{t("sync.from")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {formatDate(external.sync_from, locale)}
                </DescriptionListDescription>
              </DescriptionListItem>
            )}
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.lastSynced")}</DescriptionListTerm>
              <DescriptionListDescription>
                {external.last_synced_on === undefined
                  ? t("sync.never")
                  : formatDate(external.last_synced_on, locale)}
              </DescriptionListDescription>
            </DescriptionListItem>
            {connection.last_item_update_at !== undefined && (
              <DescriptionListItem>
                <DescriptionListTerm>{t("sync.bankData")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {formatInstant(connection.last_item_update_at, locale)}
                </DescriptionListDescription>
              </DescriptionListItem>
            )}
            {connection.next_item_update_at !== undefined && (
              <DescriptionListItem>
                <DescriptionListTerm>{t("sync.nextFetch")}</DescriptionListTerm>
                <DescriptionListDescription>
                  {formatInstant(connection.next_item_update_at, locale)}
                </DescriptionListDescription>
              </DescriptionListItem>
            )}
          </DescriptionList>
          {connection.last_error !== undefined && (
            <Alert tone="danger">
              <AlertContent>
                <AlertDescription>
                  {t("sync.lastError", { error: connection.last_error })}
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {result !== null && (
            <Text size="sm" role="status">
              {result}
            </Text>
          )}
          <Inline gap={3}>
            <Button
              loading={sync.isPending}
              onClick={() => {
                setResult(null);
                sync
                  .mutateAsync(connection.id)
                  .then((answer) => {
                    const mine = answer.batches.filter(
                      (b) => b.account_id === account.id,
                    );
                    const created = mine.reduce(
                      (s, b) => s + b.counts.created,
                      0,
                    );
                    const matched = mine.reduce(
                      (s, b) => s + b.counts.matched,
                      0,
                    );
                    setResult(
                      answer.batches.length === 0
                        ? t("sync.notSynced", { portal })
                        : t("sync.result", { created, matched }),
                    );
                  })
                  .catch((caught: unknown) => {
                    setResult(errorText(caught, t));
                  });
              }}
            >
              {t("sync.now")}
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
              variant="ghost"
              tone="danger"
              onClick={() => {
                setDialog("stop");
              }}
            >
              {t("sync.stop")}
            </Button>
          </Inline>
        </Stack>
      </CardBody>
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
    </Card>
  );
}
