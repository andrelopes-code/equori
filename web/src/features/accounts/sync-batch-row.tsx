import { Inline } from "@slotted/react/inline";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { formatInstant } from "@/features/accounts/instant";
import { syncCounts } from "@/features/accounts/sync-counts";
import type { SyncCountKey } from "@/features/accounts/sync-counts";
import type { SyncRow } from "@/features/accounts/sync-rows";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

const countTones = {
  created: "success",
  matched: "secondary",
  needs_review: "warning",
  updated: "secondary",
  withdrawn: "secondary",
  re_identified: "secondary",
} as const satisfies Record<SyncCountKey, string>;

interface SyncBatchRowProps {
  row: SyncRow;
  accounts: Map<string, Account>;
}

// A row of the table of syncs: when it ran, the account it changed and a tag for each kind of
// change; a sync that changed nothing is one row that says so.
export function SyncBatchRow({ row, accounts }: SyncBatchRowProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const account =
    row.batch === undefined ? undefined : accounts.get(row.batch.account_id);
  const counts = row.batch === undefined ? [] : syncCounts(row.batch.counts);

  return (
    <TableRow value={row.key}>
      <TableRowHeader>{formatInstant(row.startedAt, locale)}</TableRowHeader>
      <TableCell>
        {account === undefined ? (
          <Text size="sm" tone="muted">
            {t("links.syncAllAccounts")}
          </Text>
        ) : (
          <Inline gap={4} align="center">
            <AccountAvatar account={account} size="sm" />
            <Text size="sm" weight="medium">
              {account.name}
            </Text>
          </Inline>
        )}
      </TableCell>
      <TableCell>
        {counts.length === 0 ? (
          <Text size="sm" tone="muted">
            {t("links.syncNoChange")}
          </Text>
        ) : (
          <Inline gap={4} wrap="wrap">
            {counts.map(({ key, count }) => (
              <Tag key={key} size="sm" tone={countTones[key]}>
                {t(`links.count.${key}`, { count })}
              </Tag>
            ))}
          </Inline>
        )}
      </TableCell>
    </TableRow>
  );
}
