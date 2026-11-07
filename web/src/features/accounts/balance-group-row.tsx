import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import type { CSSProperties } from "react";

import type { components } from "@/api/schema.gen";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { kindTitle } from "@/features/accounts/account-kinds";
import { AccountLink } from "@/features/accounts/account-link";
import { AccountRowStatus } from "@/features/accounts/account-row-status";
import { AccountTrend } from "@/features/accounts/account-trend";
import type { SheetRow } from "@/features/accounts/balance-sheet";
import styles from "@/features/accounts/balance-sheet.module.css";
import { AccountYield } from "@/features/portfolio";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

type Institution = components["schemas"]["Institution"];

interface BalanceGroupRowProps {
  row: SheetRow;
  date: string;
  institutions: Map<string, Institution>;
  scale: (code: string) => number;
  // The group shows the yield column: one of its accounts is measured (amendment A208 R8).
  yieldColumn: boolean;
}

// One account of a balance sheet group: name and institution, kind, status, the trend of the
// last 90 days beside the balance, then the yield of those days when the group shows it.
export function BalanceGroupRow({
  row,
  date,
  institutions,
  scale,
  yieldColumn,
}: BalanceGroupRowProps) {
  const t = useT();

  const institution =
    row.account.institution_id === undefined
      ? undefined
      : institutions.get(row.account.institution_id);
  const amount = row.hasChildren ? row.subtree : row.balance;

  return (
    <TableRow value={row.account.id}>
      <TableRowHeader>
        <div
          className={styles.indent}
          style={{ "--depth": row.depth } as CSSProperties}
        >
          <Inline gap={3} wrap="nowrap">
            <AccountAvatar account={row.account} size="sm" />
            <Stack gap={0}>
              <Inline gap={4}>
                <Text size="sm" weight="medium">
                  <AccountLink account={row.account}>
                    {row.account.name}
                  </AccountLink>
                </Text>
                {row.account.closed_on !== undefined && (
                  <Tag size="sm" tone="secondary">
                    {t("balanceSheet.closed")}
                  </Tag>
                )}
              </Inline>
              {institution !== undefined && (
                <Text
                  className={row.account.kind === "credit_card" ? "ml-3" : ""}
                  size="xs"
                  tone="muted"
                >
                  {institution.name}
                </Text>
              )}
            </Stack>
          </Inline>
        </div>
      </TableRowHeader>
      <TableCell text="nowrap">
        <Text size="sm" tone="muted">
          {row.account.kind === undefined ? "" : t(kindTitle[row.account.kind])}
        </Text>
      </TableCell>
      <TableCell text="nowrap">
        {!row.hasChildren && (
          <AccountRowStatus account={row.account} scale={scale} />
        )}
      </TableCell>
      <TableCell numeric text="nowrap">
        {/* The last 90 days stand beside the balance they lead to, so the trend
            takes no column of its own for the table to widen. */}
        <Inline gap={4} justify="end" wrap="nowrap">
          {row.depth === 0 && (
            <AccountTrend
              accountId={row.account.id}
              name={row.account.name}
              date={date}
              currency={amount.currency}
              scale={scale(amount.currency)}
            />
          )}
          <Text size="sm" weight={row.depth === 0 ? "semibold" : "regular"}>
            <MoneyFigure
              amount={amount.amount}
              currency={amount.currency}
              scale={scale(amount.currency)}
            />
          </Text>
        </Inline>
      </TableCell>
      {yieldColumn && (
        <TableCell numeric text="nowrap">
          <AccountYield accountId={row.account.id} date={date} />
        </TableCell>
      )}
    </TableRow>
  );
}
