import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { Destination } from "@/app/shell/destinations";
import { useBalanceGroups } from "@/features/accounts";
import { goalsQuery } from "@/features/planning";
import { formatMoney } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";

export type IndexFigures = Partial<Record<Destination["key"], string>>;

// Shell second pass S1: the figure each destination of the ledger index carries. Overview
// reads the available balance, Cards what the cards owe, Accounts the net worth of every
// group, Goals the share saved across the goals in the base currency. Each stays absent
// until its data loads.
export function useIndexFigures(): IndexFigures {
  const [locale] = useAppLocale();
  const { groups, scale } = useBalanceGroups();
  const goals = useQuery(goalsQuery(useApi()));
  const base = groups?.[0]?.total.currency;
  if (groups === undefined || base === undefined) return {};
  const money = (amount: number) =>
    formatMoney({ amount, currency: base }, scale(base), locale);
  const total = (group: string) =>
    groups.find((g) => g.group === group)?.total.amount ?? 0;
  const figures: IndexFigures = {
    home: money(total("available")),
    accounts: money(groups.reduce((sum, g) => sum + g.total.amount, 0)),
  };
  if (groups.some((g) => g.group === "cards")) {
    figures.cards = money(-total("cards"));
  }
  const inBase = (goals.data ?? []).filter(
    (goal) => goal.target.currency === base,
  );
  const target = inBase.reduce((sum, goal) => sum + goal.target.amount, 0);
  if (target > 0) {
    const saved = inBase.reduce((sum, goal) => sum + goal.current.amount, 0);
    figures.goals = `${String(Math.floor((saved * 100) / target))}%`;
  }
  return figures;
}
