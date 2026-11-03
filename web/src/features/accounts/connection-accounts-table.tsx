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
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { ConnectionAccountActions } from "@/features/accounts/connection-account-actions";
import type { ConnectionMessage } from "@/features/accounts/connection-account-actions";
import { subtypeWords } from "@/features/accounts/external-subtype";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Connection = components["schemas"]["Connection"];
type ExternalAccount = components["schemas"]["ExternalAccount"];

interface ConnectionAccountsTableProps {
  connection: Connection;
  accounts: Map<string, Account>;
  onLink: (external: ExternalAccount) => void;
  onMessage: (message: ConnectionMessage | null) => void;
}

export function ConnectionAccountsTable({
  connection,
  accounts,
  onLink,
  onMessage,
}: ConnectionAccountsTableProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <Table columns={5} variant="framed">
      <TableContent>
        <TableCaption>{connection.name}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("sync.external")}</TableColumnHeader>
            <TableColumnHeader>{t("sync.from")}</TableColumnHeader>
            <TableColumnHeader>{t("sync.lastSynced")}</TableColumnHeader>
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
                        external.currency,
                      ]
                        .filter((p) => p !== undefined)
                        .join(" · ")}
                    </Text>
                  </Stack>
                </TableRowHeader>
                <TableCell>
                  {external.sync_from === undefined
                    ? t("sync.never")
                    : formatDate(external.sync_from, locale)}
                </TableCell>
                <TableCell>
                  {external.last_synced_on === undefined
                    ? t("sync.never")
                    : formatDate(external.last_synced_on, locale)}
                </TableCell>
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
                  <ConnectionAccountActions
                    connectionId={connection.id}
                    external={external}
                    onLink={onLink}
                    onMessage={onMessage}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </TableContent>
    </Table>
  );
}
