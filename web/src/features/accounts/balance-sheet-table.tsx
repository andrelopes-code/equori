import { VisuallyHidden } from "@slotted/react/visually-hidden";

import type { components } from "@/api/schema.gen";
import { AccountMenu } from "@/features/accounts/account-menu";
import { flattenTree } from "@/features/accounts/account-tree";
import type { TreeNode } from "@/features/accounts/account-tree";
import styles from "@/features/accounts/accounts-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];

// Families read: table. Accounts second pass A2 draws one class of balance accounts as a
// ledger with an action menu on every row; the table family re-measures its parts on each
// menu's open and close, which made a row's menu take seconds, so the ledger is a table of the
// app's own with the family's rules: ruled rows, muted heads, a double rule over the total.
// A liability reads as what is owed; the total adds the accounts in the base currency.
export function BalanceSheetTable({
  label,
  roots,
  owed,
  base,
  balanceOf,
  scale,
  onEdit,
  onClose,
}: {
  label: string;
  roots: TreeNode[];
  owed: boolean;
  base: string;
  balanceOf: (account: Account) => Money;
  scale: (code: string) => number;
  onEdit: (account: Account) => void;
  onClose: (account: Account) => void;
}) {
  const t = useT();
  const spaLink = useSpaLink();
  const rows = flattenTree(roots);
  const shown = (money: Money): Money => ({
    amount: owed ? -money.amount : money.amount,
    currency: money.currency,
  });
  const total = rows.reduce((sum, { account }) => {
    const balance = balanceOf(account);
    return balance.currency === base ? sum + shown(balance).amount : sum;
  }, 0);
  return (
    <table className={styles.sheet} aria-label={label}>
      <thead>
        <tr>
          <th scope="col">{label}</th>
          <th scope="col">{t("accounts.column.kind")}</th>
          <th scope="col" data-numeric="">
            {t("accounts.column.balance")}
          </th>
          <th scope="col">
            <VisuallyHidden>{t("accounts.column.account")}</VisuallyHidden>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ account, depth }) => {
          const balance = balanceOf(account);
          return (
            <tr key={account.id} data-depth={depth}>
              <th scope="row">
                <a
                  {...spaLink(
                    account.kind === "credit_card"
                      ? `/cards/${account.id}`
                      : `/accounts/${account.id}`,
                  )}
                  className={styles.name}
                  data-depth={depth}
                >
                  {account.name}
                </a>
              </th>
              <td>
                <span className={styles.muted}>
                  {account.kind === undefined
                    ? null
                    : t(`accounts.kind.${account.kind}`)}
                </span>
              </td>
              <td data-numeric="">
                <MoneyText
                  money={shown(balance)}
                  scale={scale(balance.currency)}
                  symbol={balance.currency !== base}
                />
              </td>
              <td>
                <AccountMenu
                  name={account.name}
                  onEdit={() => {
                    onEdit(account);
                  }}
                  onClose={() => {
                    onClose(account);
                  }}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{t("accounts.group.total")}</th>
          <td />
          <td data-numeric="">
            <MoneyText
              money={{ amount: total, currency: base }}
              scale={scale(base)}
              symbol={false}
            />
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
