import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { currentAndUnpaid, statementsQuery } from "@/features/cards";
import { walletView } from "@/features/overview/cards/wallet";
import { shiftMonth } from "@/features/overview/model/forecast";
import { useBase } from "@/features/overview/model/use-base";
import { useToday } from "@/i18n/today";

// Twelve months back hold every closed statement still owing in practice.
const lookBackMonths = 12;

// The reads of the Cards widget and the wallet they give; `view` is undefined while they load.
export function useWallet() {
  const api = useApi();
  const today = useToday();
  const { base, scale } = useBase();
  const from = shiftMonth(today.slice(0, 7), -lookBackMonths);
  const accounts = useQuery(accountsQuery(api));
  const cards = (accounts.data ?? []).filter(
    (account) =>
      account.kind === "credit_card" && account.closed_on === undefined,
  );
  const statements = useQueries({
    queries: cards.map((card) => statementsQuery(api, card.id, from)),
  });

  const error =
    accounts.error ??
    statements.find((query) => query.error !== null)?.error ??
    null;
  const ready =
    accounts.data !== undefined &&
    base !== undefined &&
    scale !== null &&
    error === null &&
    statements.every((query) => query.data !== undefined);
  const view = ready
    ? walletView(
        cards.map((account, i) => ({
          account,
          ...currentAndUnpaid(statements[i]?.data ?? []),
          statements: statements[i]?.data ?? [],
        })),
        today,
        base,
      )
    : undefined;

  function retry() {
    if (accounts.isError) void accounts.refetch();

    for (const query of statements) {
      if (query.isError) void query.refetch();
    }
  }

  return { view, scale, error, retry };
}
