import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";

import { AccountGroupsPlaceholder } from "@/features/accounts/account-groups-placeholder";
import { groupLabels } from "@/features/accounts/balance-groups";
import { useBalanceGroups } from "@/features/accounts/use-balance-groups";
import { useT } from "@/i18n/i18n-provider";
import { AmountLine } from "@/ui/amount-line";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

// The figures region reports a failed or empty answer; this list then draws nothing.
export function AccountGroups() {
  const t = useT();
  const spaLink = useSpaLink();
  const { groups, scale, failed } = useBalanceGroups();
  if (failed) return null;
  if (groups === undefined) {
    return <AccountGroupsPlaceholder />;
  }
  return (
    <List variant="ruled" aria-label={t("home.accounts")}>
      {groups.map(({ group, items }) => (
        <ListSection key={group} label={t(groupLabels[group])} level="3">
          {items.map(({ account, balance }) => (
            <ListItem key={account.id}>
              <ListItemLink {...spaLink(`/accounts/${account.id}`)}>
                <ListItemBody>
                  <ListItemLabel>
                    <AmountLine
                      own="balance-line"
                      title={account.name}
                      amount={
                        <MoneyText
                          money={balance}
                          scale={scale(balance.currency)}
                        />
                      }
                    />
                  </ListItemLabel>
                </ListItemBody>
              </ListItemLink>
            </ListItem>
          ))}
        </ListSection>
      ))}
    </List>
  );
}
