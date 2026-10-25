import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts";
import { FactItem } from "@/features/transactions/fact-item";

type Account = components["schemas"]["Account"];

export function AccountFact({
  label,
  id,
  accounts,
}: {
  label: string;
  id: string;
  accounts: readonly Account[];
}) {
  const account = accounts.find((a) => a.id === id);
  return (
    <FactItem label={label}>
      {account === undefined ? undefined : (
        <AccountLink account={account}>{account.name}</AccountLink>
      )}
    </FactItem>
  );
}
