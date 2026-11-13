import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
  ListItemStart,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { AccountAvatar } from "@/features/accounts/account-mark/account-avatar";
import { AccountRowStatus } from "@/features/accounts/account-mark/account-row-status";
import styles from "@/features/accounts/balance-sheet/balance-group-list.module.css";
import { listRailClass } from "@/features/accounts/balance-sheet/rail-class";
import type { SheetLine } from "@/features/accounts/balance-sheet/sheet-lines";
import { accountRoute } from "@/features/accounts/model/account-route";
import { kindTitle } from "@/features/accounts/model/account-kinds";
import { AccountYield } from "@/features/portfolio";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";
import { routeTo } from "@/ui/navigation/route-to";

type AccountLine = Extract<SheetLine, { type: "account" }>;

interface SheetAccountListItemProps {
  line: AccountLine;
  institution: string | undefined;
  date: string;
  scale: (code: string) => number;
}

// One account of the list on a phone: a row that opens the account. The mark and the name, the
// kind and the institution under the name, then the status on a line of its own; the amount and
// the yield, or the words that say a parent's amount is a sum, at the end (AL12).
export function SheetAccountListItem({
  line,
  institution,
  date,
  scale,
}: SheetAccountListItemProps) {
  const t = useT();
  const { row } = line;
  const { account } = row;
  const parent = row.hasChildren;
  const child = row.depth > 0;
  const amount = parent ? row.subtree : row.balance;
  const caption = [
    account.kind === undefined || row.position
      ? undefined
      : t(kindTitle[account.kind]),
    institution,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");

  return (
    <ListItem className={listRailClass(child, line.first, line.last)}>
      <ListItemLink render={routeTo(accountRoute(account))}>
        <ListItemStart>
          <AccountAvatar account={account} size={child ? "sm" : "md"} />
        </ListItemStart>
        <ListItemBody>
          <ListItemLabel className={styles.name}>{account.name}</ListItemLabel>
          {caption !== "" && (
            <ListItemDescription>{caption}</ListItemDescription>
          )}
          {!parent && !row.position && (
            <ListItemDescription>
              <AccountRowStatus account={account} scale={scale} quiet compact />
            </ListItemDescription>
          )}
        </ListItemBody>
        <ListItemEnd>
          <Stack gap={0} align="end">
            <Text size="sm" weight={parent ? "semibold" : "regular"}>
              <MoneyFigure
                amount={amount.amount}
                currency={amount.currency}
                scale={scale(amount.currency)}
              />
            </Text>
            {parent ? (
              <Text size="xs" tone="muted">
                {t("balanceSheet.sumOfSubAccounts")}
              </Text>
            ) : (
              <div className={styles.yield}>
                <AccountYield accountId={account.id} date={date} compact />
              </div>
            )}
          </Stack>
        </ListItemEnd>
      </ListItemLink>
    </ListItem>
  );
}
