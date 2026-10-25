import { List } from "@slotted/react/list";
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

import type { components } from "@/api/schema.gen";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { accountHref, accountRoute } from "@/features/accounts/account-route";
import { AccountRowStatus } from "@/features/accounts/account-row-status";
import type { SheetRow } from "@/features/accounts/balance-sheet";
import styles from "@/features/accounts/balance-group-list.module.css";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";
import { useAppLink } from "@/ui/use-app-link";

type Institution = components["schemas"]["Institution"];
type Money = components["schemas"]["Money"];

// Below 600 px a group is a list of rows that open the account (LP-01): mark, name and
// institution, balance and status at the end. An institution that repeats the name is left out.
export function BalanceGroupList({
  label,
  rows,
  total,
  excluded,
  institutions,
  scale,
}: {
  label: string;
  rows: SheetRow[];
  total: Money;
  excluded: number;
  institutions: Map<string, Institution>;
  scale: (code: string) => number;
}) {
  const t = useT();
  const follow = useAppLink();
  return (
    <Stack gap={2}>
      <Stack gap={0}>
        <Text size="md" weight="semibold">
          {label}
        </Text>
        <Text size="sm" tone="muted">
          <MoneyFigure
            amount={total.amount}
            currency={total.currency}
            scale={scale(total.currency)}
          />
          {excluded > 0 &&
            ` · ${t("balanceSheet.excluded", { count: excluded })}`}
        </Text>
      </Stack>
      <List aria-label={label} variant="framed">
        {rows.map((row) => {
          const amount = row.hasChildren ? row.subtree : row.balance;
          const institution =
            row.account.institution_id === undefined
              ? undefined
              : institutions.get(row.account.institution_id)?.name;
          return (
            <ListItem key={row.account.id} className={styles.row}>
              <ListItemLink
                href={accountHref(row.account)}
                onClick={follow(accountRoute(row.account))}
              >
                <ListItemStart>
                  <AccountAvatar account={row.account} size="sm" />
                </ListItemStart>
                <ListItemBody>
                  <ListItemLabel>
                    {row.depth > 0 ? `↳ ${row.account.name}` : row.account.name}
                  </ListItemLabel>
                  <ListItemDescription>
                    <span className={styles.meta}>
                      {institution !== undefined &&
                        institution.toLowerCase() !==
                          row.account.name.toLowerCase() && (
                          <span>{institution}</span>
                        )}
                      {!row.hasChildren && (
                        <AccountRowStatus account={row.account} scale={scale} />
                      )}
                    </span>
                  </ListItemDescription>
                </ListItemBody>
                <ListItemEnd>
                  <MoneyFigure
                    amount={amount.amount}
                    currency={amount.currency}
                    scale={scale(amount.currency)}
                  />
                </ListItemEnd>
              </ListItemLink>
            </ListItem>
          );
        })}
      </List>
    </Stack>
  );
}
