import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { recordShape } from "@/features/accounts/kind-figures/record-shape";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import type { BuiltKind } from "@/features/transactions";

type Account = components["schemas"]["Account"];

// What an account's page offers to do, and the navigation of each action.
export function useAccountActions(account: Account) {
  const navigate = useNavigate();
  const instruments = useQuery(instrumentsQuery(useApi()));
  const base = useQuery(settingsQuery(useApi())).data?.base_currency;

  // A trade is recorded on the account that holds the security.
  const security = (instruments.data?.items ?? []).some(
    (i) => i.code === account.currency && i.type !== "currency",
  );
  // A currency exchange starts from an account that holds a currency other than the base.
  const foreignCurrency =
    base !== undefined &&
    account.currency !== base &&
    (instruments.data?.items ?? []).some(
      (i) => i.code === account.currency && i.type === "currency",
    );
  const closed = account.closed_on !== undefined;
  // K9: a property has no statement to import and is revalued rather than reconciled.
  const property = recordShape(account) === "property";

  const recordInvestment = (kind: BuiltKind) => () => {
    void navigate({
      to: "/transactions/new",
      search: { account_id: account.id, kind },
    });
  };

  function newTransaction() {
    void navigate({
      to: "/transactions/new",
      search: { account_id: account.id },
    });
  }

  function recordBalance() {
    void navigate({
      to: "/accounts/$id",
      params: { id: account.id },
      search: { tab: "reconciliation", assert: true },
    });
  }

  function importStatement() {
    void navigate({
      to: "/accounts/$id/import",
      params: { id: account.id },
    });
  }

  return {
    security,
    foreignCurrency,
    closed,
    property,
    recordInvestment,
    newTransaction,
    recordBalance,
    importStatement,
  };
}
