import { Link } from "@slotted/react/link";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContent,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";

import { AccountGroupsPlaceholder } from "@/features/accounts/account-groups-placeholder";
import { groupLabels } from "@/features/accounts/balance-groups";
import styles from "@/features/accounts/account-groups.module.css";
import { useBalanceGroups } from "@/features/accounts/use-balance-groups";
import { useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

// Ledger sheet L17: one table per balance group, captioned by the group.
// The figures region reports a failed or empty answer; this region then draws nothing.
export function AccountGroups() {
  const t = useT();
  const spaLink = useSpaLink();
  const { groups, scale, failed } = useBalanceGroups();
  if (failed) return null;
  if (groups === undefined) {
    return <AccountGroupsPlaceholder />;
  }
  return (
    <div className={styles.groups}>
      {groups.map(({ group, items }) => (
        <Table key={group} columns={2}>
          <TableContent>
            <TableCaption>{t(groupLabels[group])}</TableCaption>
            <TableBody>
              {items.map(({ account, balance }) => (
                <TableRow key={account.id}>
                  <TableRowHeader>
                    <Link
                      {...spaLink(`/accounts/${account.id}`)}
                      variant="neutral"
                      underline="hover"
                    >
                      {account.name}
                    </Link>
                  </TableRowHeader>
                  <TableCell numeric text="nowrap">
                    <MoneyText
                      money={balance}
                      scale={scale(balance.currency)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableContent>
        </Table>
      ))}
    </div>
  );
}
