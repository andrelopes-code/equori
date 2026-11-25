import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import {
  TableCell,
  TableExpander,
  TableMark,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { AccountAvatar } from "@/features/accounts/account-mark/account-avatar";
import { AccountLink } from "@/features/accounts/account-mark/account-link";
import { AccountRowStatus } from "@/features/accounts/account-mark/account-row-status";
import { AccountTrend } from "@/features/accounts/balance-sheet/account-trend";
import type { SheetLine } from "@/features/accounts/balance-sheet/sheet-lines";
import styles from "@/features/accounts/balance-sheet/sheet-tree.module.css";
import { LoanLine } from "@/features/accounts/kind-figures/loan-line";
import { PropertyChangeNote } from "@/features/accounts/kind-figures/property-change-note";
import { recordShape } from "@/features/accounts/kind-figures/record-shape";
import { kindTitle } from "@/features/accounts/model/account-kinds";
import { shapeOf } from "@/features/accounts/model/account-shape";
import { AccountYield } from "@/features/portfolio";
import { useT } from "@/i18n/i18n-provider";
import { TitleTag } from "@/ui/display/title-tag";
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
}: SheetAccountRowProps) {
  const t = useT();
  const { row } = line;
  const { account } = row;
  const parent = row.hasChildren;
  const child = row.depth > 0;
  const amount = parent ? row.subtree : row.balance;
  const shape = recordShape(account);
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
      level={row.depth}
      parent={row.parentId}
      className={parent ? styles.container : undefined}
    >
      <TableRowHeader className={child ? undefined : styles.account}>
        {parent && !child && (
          <TableExpander
            aria-label={t(
              line.open ? "balanceSheet.collapse" : "balanceSheet.expand",
              { name: account.name },
            )}
          />
        )}

        <TableMark>
          <AccountAvatar account={account} size={child ? "sm" : "md"} />
        </TableMark>

        <div className={styles.text}>
          <Inline gap={4} wrap="nowrap" align="center">
            <Text size="sm" weight={parent ? "semibold" : "medium"} truncate>
              <AccountLink account={account}>{account.name}</AccountLink>
            </Text>
            {account.closed_on !== undefined && (
              <TitleTag tone="secondary">{t("balanceSheet.closed")}</TitleTag>
            )}
            {parent && (
              <Text size="xs" tone="muted" wrap="nowrap">
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
            <Text
              // The badge of a card passes the corner of its mark, onto this line.
              className={shapeOf(account.kind) === "card" ? "ml-4" : undefined}
              size="xs"
              tone="muted"
              truncate
            >
              {caption}
            </Text>
          )}
        </div>
      </TableRowHeader>

      <TableCell text="nowrap">
        {!parent && !row.position && shape !== "loan" && (
          <AccountRowStatus account={account} scale={scale} quiet />
        )}
        {!parent && shape === "loan" && <LoanLine account={account} />}
      </TableCell>

      <TableCell numeric text="nowrap">
        <Inline gap={5} justify="end" align="center" wrap="nowrap">
          {/* K10: a property or a loan reads its own line, not 90 flat days. */}
          {row.depth === 0 && shape === "cash" && (
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
            {!parent && shape === "property" && (
              <PropertyChangeNote account={account} />
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
