import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { useHoldings } from "@/features/portfolio/holdings/use-holdings";
import type {
  AllocationBy,
  PortfolioSearch,
  SearchPatch,
} from "@/features/portfolio/model/portfolio-search";
import { institutionsQuery, settingsQuery } from "@/features/setup";
import { useToday } from "@/i18n/today";

type PortfolioViewRoute = "/portfolio" | "/portfolio/positions";

// What the summary and the positions page read the same way: the search of the route, the holdings
// at its date and currency, the institution names and the empty and trade conditions.
export function usePortfolioView(route: PortfolioViewRoute) {
  const today = useToday();
  const api = useApi();
  const search: PortfolioSearch = useSearch({ from: `/_authed${route}` });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const institutions = useQuery(institutionsQuery(api));

  const date = search.date ?? today;
  const valueIn = search.value_in ?? base;
  const by: AllocationBy = search.by ?? "type";
  const { holdings, summary, pending, positions, accounts } = useHoldings(
    date,
    valueIn,
  );
  const names = new Map((institutions.data ?? []).map((i) => [i.id, i.name]));
  const empty = !pending && holdings.length === 0;
  const hasBrokerage = (accounts.data ?? []).some(
    (a) => a.kind === "brokerage" && a.parent_id === undefined,
  );

  function change(patch: SearchPatch) {
    const next = Object.fromEntries(
      Object.entries({ ...search, ...patch }).filter(
        ([, value]) => value !== undefined,
      ),
    );

    void navigate({ to: route, search: next, replace: true });
  }

  return {
    today,
    search,
    date,
    valueIn,
    base,
    by,
    holdings,
    summary,
    pending,
    positions,
    accounts,
    names,
    empty,
    hasBrokerage,
    change,
  };
}
