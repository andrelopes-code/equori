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
  TableSummary,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import type { CSSProperties } from "react";

import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts/account-link";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { kindTitle } from "@/features/accounts/account-kinds";
import { AccountRowStatus } from "@/features/accounts/account-row-status";
import { AccountTrend } from "@/features/accounts/account-trend";
import styles from "@/features/accounts/balance-sheet.module.css";
import type { SheetRow } from "@/features/accounts/balance-sheet";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

type Institution = components["schemas"]["Institution"];
type Money = components["schemas"]["Money"];

// A group of the balance sheet holds a household's accounts of one kind: a bounded set, so a
// table (LP-14) with the group's total in its summary row (RP-07).
export function BalanceGroupTable({
  label,
  rows,
  total,
  excluded,
  date,
  institutions,
  scale,
}: {
  label: string;
  rows: SheetRow[];
  total: Money;
  excluded: number;
  date: string;
  institutions: Map<string, Institution>;
  scale: (code: string) => number;
}) {
  const t = useT();
  return (
    <Stack gap={2}>
      <Table columns={4} variant="framed">
        <TableContent>
          <TableCaption>{label}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("balanceSheet.account")}</TableColumnHeader>
              <TableColumnHeader className={styles.fit}>
                {t("balanceSheet.kind")}
              </TableColumnHeader>
              <TableColumnHeader className={styles.fit}>
                {t("balanceSheet.status")}
              </TableColumnHeader>
              <TableColumnHeader numeric className={styles.fit}>
                {t("balanceSheet.balance")}
              </TableColumnHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const institution =
                row.account.institution_id === undefined
                  ? undefined
                  : institutions.get(row.account.institution_id);
              const amount = row.hasChildren ? row.subtree : row.balance;
              return (
                <TableRow key={row.account.id} value={row.account.id}>
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
                            <Text size="xs" tone="muted">
                              {institution.name}
                            </Text>
                          )}
                        </Stack>
                      </Inline>
                    </div>
                  </TableRowHeader>
                  <TableCell text="nowrap">
                    <Text size="sm" tone="muted">
                      {row.account.kind === undefined
                        ? ""
                        : t(kindTitle[row.account.kind])}
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
                      <Text
                        size="sm"
                        weight={row.depth === 0 ? "semibold" : "regular"}
                      >
                        <MoneyFigure
                          amount={amount.amount}
                          currency={amount.currency}
                          scale={scale(amount.currency)}
                        />
                      </Text>
                    </Inline>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableSummary>
            <TableRow>
              <TableRowHeader colSpan={3}>
                {t("balanceSheet.groupTotal")}
              </TableRowHeader>
              <TableCell numeric>
                <Text size="sm" weight="semibold">
                  <MoneyFigure
                    amount={total.amount}
                    currency={total.currency}
                    scale={scale(total.currency)}
                  />
                </Text>
              </TableCell>
            </TableRow>
          </TableSummary>
        </TableContent>
      </Table>
      {excluded > 0 && (
        <Text size="sm" tone="muted">
          {t("balanceSheet.excluded", { count: excluded })}
        </Text>
      )}
    </Stack>
  );
}
