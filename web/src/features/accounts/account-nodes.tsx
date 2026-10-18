import { TreeNode as SlottedTreeNode } from "@slotted/react/tree";

import type { components } from "@/api/schema.gen";
import { AccountMenu } from "@/features/accounts/account-menu";
import type { TreeNode } from "@/features/accounts/account-tree";
import { MoneyText } from "@/ui/money-text";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];

// A balance is shown only for balance accounts (those with a kind), and is always the account's own postings (B2).
export function AccountNodes({
  nodes,
  balanceOf,
  scale,
  onEdit,
  onClose,
}: {
  nodes: TreeNode[];
  balanceOf: (account: Account) => Money | null;
  scale: (code: string) => number;
  onEdit: (account: Account) => void;
  onClose: (account: Account) => void;
}) {
  return nodes.map(({ account, children }) => {
    const balance = balanceOf(account);
    return (
      <SlottedTreeNode
        key={account.id}
        value={account.id}
        label={account.name}
        {...(balance === null
          ? {}
          : {
              meta: (
                <MoneyText
                  money={balance}
                  scale={scale(balance.currency)}
                  tone="balance"
                />
              ),
            })}
        actions={
          <AccountMenu
            name={account.name}
            onEdit={() => {
              onEdit(account);
            }}
            onClose={() => {
              onClose(account);
            }}
          />
        }
      >
        {children.length > 0 && (
          <AccountNodes
            nodes={children}
            balanceOf={balanceOf}
            scale={scale}
            onEdit={onEdit}
            onClose={onClose}
          />
        )}
      </SlottedTreeNode>
    );
  });
}
