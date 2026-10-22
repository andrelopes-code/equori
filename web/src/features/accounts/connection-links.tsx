import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import {
  useMapExternalAccount,
  useSyncConnection,
} from "@/features/accounts/api";
import { formatInstant } from "@/features/accounts/instant";
import { subtypeWords } from "@/features/accounts/sync-tab";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];
type ExternalAccount = components["schemas"]["ExternalAccount"];

const providerWords: Record<string, MessageKey> = {
  UPDATED: "sync.provider.UPDATED",
  UPDATING: "sync.provider.UPDATING",
  LOGIN_ERROR: "sync.provider.LOGIN_ERROR",
  OUTDATED: "sync.provider.OUTDATED",
  WAITING_USER_INPUT: "sync.provider.WAITING_USER_INPUT",
};

// One connection: its provider's state, a sync on demand, and each account it brings with the
// ledger account that account feeds.
export function ConnectionLinks({
  connection,
  accounts,
  onLink,
}: {
  connection: Connection;
  accounts: Map<string, Account>;
  onLink: (external: ExternalAccount) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const sync = useSyncConnection();
  const ignore = useMapExternalAccount();
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);
  const provider = providerWords[connection.provider_status];
  const facts = [
    provider === undefined ? connection.provider_status : t(provider),
    connection.last_synced_at === undefined
      ? undefined
      : t("links.syncedAt", {
          time: formatInstant(connection.last_synced_at, locale),
        }),
    connection.next_item_update_at === undefined
      ? undefined
      : t("links.nextUpdate", {
          time: formatInstant(connection.next_item_update_at, locale),
        }),
  ].filter((p) => p !== undefined);
  return (
    <Stack gap={3}>
      <Inline justify="between" gap={4}>
        <Stack gap={0}>
          <Heading level={2} size="md">
            {connection.name}
          </Heading>
          <Text size="sm" tone="muted">
            {facts.join(" · ")}
          </Text>
        </Stack>
        <Button
          variant="outline"
          loading={sync.isPending}
          aria-label={t("links.syncOf", { name: connection.name })}
          onClick={() => {
            setMessage(null);
            sync
              .mutateAsync(connection.id)
              .then((answer) => {
                setMessage({
                  tone: "success",
                  text:
                    answer.batches.length === 0
                      ? t("sync.notSynced")
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
      <Table columns={4} variant="framed">
        <TableContent>
          <TableCaption>{connection.name}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("sync.external")}</TableColumnHeader>
              <TableColumnHeader>{t("accountForm.currency")}</TableColumnHeader>
              <TableColumnHeader>{t("links.state")}</TableColumnHeader>
              <TableColumnHeader align="end">
                {t("links.actions")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {connection.accounts.map((external) => {
              const subtype = subtypeWords[external.subtype];
              const target =
                external.account_id === undefined
                  ? undefined
                  : accounts.get(external.account_id);
              return (
                <TableRow key={external.id} value={external.id}>
                  <TableRowHeader>
                    <Stack gap={0}>
                      <Text size="sm" weight="medium">
                        {external.name}
                      </Text>
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
                  </TableRowHeader>
                  <TableCell>{external.currency}</TableCell>
                  <TableCell>
                    {external.state === "mapped" ? (
                      <Tag size="sm" tone="success">
                        {t("links.state.mapped", {
                          account: target?.name ?? "",
                        })}
                      </Tag>
                    ) : external.state === "ignored" ? (
                      <Tag size="sm" tone="secondary">
                        {t("links.state.ignored")}
                      </Tag>
                    ) : (
                      <Tag size="sm" tone="warning">
                        {t("links.state.pending")}
                      </Tag>
                    )}
                  </TableCell>
                  <TableCell align="end">
                    <Inline gap={2} justify="end">
                      <Button
                        size="sm"
                        variant={
                          external.state === "pending" ? "solid" : "outline"
                        }
                        onClick={() => {
                          onLink(external);
                        }}
                      >
                        {external.state === "mapped"
                          ? t("links.change")
                          : t("links.link")}
                      </Button>
                      {external.state === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          tone="secondary"
                          loading={
                            ignore.isPending &&
                            ignore.variables.externalId === external.id
                          }
                          onClick={() => {
                            setMessage(null);
                            ignore
                              .mutateAsync({
                                connectionId: connection.id,
                                externalId: external.id,
                                mapping: { ignored: true },
                              })
                              .catch((caught: unknown) => {
                                setMessage({
                                  tone: "danger",
                                  text: errorText(caught, t),
                                });
                              });
                          }}
                        >
                          {t("links.ignore")}
                        </Button>
                      )}
                    </Inline>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </TableContent>
      </Table>
    </Stack>
  );
}
