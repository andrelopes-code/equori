import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import { AccountAvatar } from "@/features/accounts/account-mark/account-avatar";
import { AccountLink } from "@/features/accounts/account-mark/account-link";
import { AccountRowStatus } from "@/features/accounts/account-mark/account-row-status";
import { AccountTrend } from "@/features/accounts/balance-sheet/account-trend";
import styles from "@/features/accounts/balance-sheet/sheet-rail.module.css";
import { railClass } from "@/features/accounts/balance-sheet/rail-class";
import { SheetToggle } from "@/features/accounts/balance-sheet/sheet-toggle";
import type { SheetLine } from "@/features/accounts/balance-sheet/sheet-lines";
import { kindTitle } from "@/features/accounts/model/account-kinds";
import { AccountYield } from "@/features/portfolio";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

type AccountLine = Extract<SheetLine, { type: "account" }>;

interface SheetAccountRowProps {
  line: AccountLine;
  // The institution written under the name, when the group does not already say it.
  institution: string | undefined;
  date: string;
  scale: (code: string) => number;
  // The group shows the yield column.
  yieldColumn: boolean;
  onToggle: (accountId: string) => void;
}

// One account of the list: mark, name and caption, status, then the trend, the balance and,
// under it the words that say a parent's balance is a sum, then the yield when the group has
// the column (AL8, AL10).
export function SheetAccountRow({
  line,
  institution,
  date,
  scale,
  yieldColumn,
  onToggle,
}: SheetAccountRowProps) {
  const t = useT();
  const { row } = line;
  const { account } = row;
  const parent = row.hasChildren;
  const child = row.depth > 0;
  const amount = parent ? row.subtree : row.balance;
  // A position is a quantity under its parent: the kind of its parent says nothing new.
  const caption = [
    account.kind === undefined || row.position
      ? undefined
      : t(kindTitle[account.kind]),
    institution,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");

  return (
    <TableRow
      value={account.id}
      className={parent ? styles.container : undefined}
    >
      <TableRowHeader className={railClass(child, line.first, line.last)}>
        <div className={styles.account}>
          {!child &&
            (parent ? (
              <SheetToggle
                open={line.open}
                label={t(
                  line.open ? "balanceSheet.collapse" : "balanceSheet.expand",
                  { name: account.name },
                )}
                onToggle={() => {
                  onToggle(account.id);
                }}
              />
            ) : (
              <span className={styles.slot} aria-hidden="true" />
            ))}
          <AccountAvatar account={account} size={child ? "sm" : "md"} />
          <div className={styles.text}>
            <Inline gap={4} wrap="nowrap" align="center">
              <Text size="sm" weight={parent ? "semibold" : "medium"} truncate>
                <AccountLink account={account}>{account.name}</AccountLink>
              </Text>
              {account.closed_on !== undefined && (
                <Tag size="sm" tone="secondary">
                  {t("balanceSheet.closed")}
                </Tag>
              )}
              {parent && (
                <Text size="xs" tone="muted">
                  {t(
                    row.childCount === 1
                      ? "balanceSheet.subAccountsOne"
                      : "balanceSheet.subAccounts",
                    { count: row.childCount },
                  )}
                </Text>
              )}
            </Inline>
            {caption !== "" && (
              <Text size="xs" tone="muted" truncate>
                {caption}
              </Text>
            )}
          </div>
        </div>
      </TableRowHeader>

      <TableCell text="nowrap">
        {!parent && !row.position && (
          <AccountRowStatus account={account} scale={scale} quiet />
        )}
      </TableCell>

      <TableCell numeric text="nowrap">
        <Inline gap={5} justify="end" align="center" wrap="nowrap">
          {row.depth === 0 && (
            <AccountTrend
              accountId={account.id}
              name={account.name}
              date={date}
              currency={amount.currency}
              scale={scale(amount.currency)}
            />
          )}
          <Stack gap={0} align="end">
            <Text size="sm" weight={parent ? "semibold" : "regular"}>
              <MoneyFigure
                amount={amount.amount}
                currency={amount.currency}
                scale={scale(amount.currency)}
              />
            </Text>
            {parent && (
              <Text size="xs" tone="muted">
                {t("balanceSheet.sumOfSubAccounts")}
              </Text>
            )}
          </Stack>
        </Inline>
      </TableCell>

      {yieldColumn && (
        <TableCell numeric>
          <AccountYield accountId={account.id} date={date} />
        </TableCell>
      )}
    </TableRow>
  );
}
