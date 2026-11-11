import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import {
  instrumentsQuery,
  payeesQuery,
  settingsQuery,
  useScale,
} from "@/features/setup";
import { transactionQuery } from "@/features/transactions/api";

export type TransactionData =
  | { status: "loading" }
  | { status: "error"; error: Error; retry: () => void }
  | {
      status: "ready";
      transaction: components["schemas"]["Transaction"];
      accounts: components["schemas"]["Account"][];
      payees: components["schemas"]["Payee"][];
      baseCurrency: string;
      scale: (code: string) => number;
    };

// Everything a page that shows or edits one transaction needs, loaded together.
export function useTransactionData(id: string): TransactionData {
  const api = useApi();
  const transaction = useQuery(transactionQuery(api, id));
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const scale = useScale();
  const queries = [transaction, accounts, payees, settings, instruments];
  const failed = queries.find((q) => q.isError);
  if (failed?.error) {
    const error = failed.error;
    return {
      status: "error",
      error,
      retry: () => {
        for (const query of queries) {
          if (query.isError) void query.refetch();
        }
      },
    };
  }
  const baseCurrency = settings.data?.base_currency;
  if (
    transaction.data === undefined ||
    accounts.data === undefined ||
    payees.data === undefined ||
    baseCurrency === undefined ||
    scale === null
  ) {
    return { status: "loading" };
  }
  return {
    status: "ready",
    transaction: transaction.data,
    accounts: accounts.data,
    payees: payees.data,
    baseCurrency,
    scale,
  };
}
