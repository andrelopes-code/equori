import type { components } from "@/api/schema.gen";
import { AccountMenu } from "@/features/accounts/account-menu";
import { flattenTree } from "@/features/accounts/account-tree";
import type { TreeNode } from "@/features/accounts/account-tree";
import styles from "@/features/accounts/accounts-page.module.css";

type Account = components["schemas"]["Account"];

// Accounts second pass A3: categories carry no balance, so a class reads as an index of names
// in columns, sub-categories indented under their parent.
export function CategoryIndex({
  label,
  roots,
  onEdit,
  onClose,
}: {
  label: string;
  roots: TreeNode[];
  onEdit: (account: Account) => void;
  onClose: (account: Account) => void;
}) {
  return (
    <ul aria-label={label} className={styles.index}>
      {flattenTree(roots).map(({ account, depth }) => (
        <li key={account.id} className={styles.entry} data-depth={depth}>
          <span className={styles.entryName}>{account.name}</span>
          <AccountMenu
            name={account.name}
            onEdit={() => {
              onEdit(account);
            }}
            onClose={() => {
              onClose(account);
            }}
          />
        </li>
      ))}
    </ul>
  );
}
