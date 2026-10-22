import { useQueries } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { statementsQuery } from "@/features/cards/api";
import { currentAndUnpaid } from "@/features/cards/card-totals";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { useToday } from "@/i18n/today";

type Account = components["schemas"]["Account"];

// Twelve months back hold every closed statement still owing in practice; one read per card.
export function useCardStatements(cards: readonly Account[]) {
  const api = useApi();
  const today = useToday();
  const from = addMonths(currentMonth(today), -12);
  const results = useQueries({
    queries: cards.map((card) => statementsQuery(api, card.id, from)),
  });
  return cards.map((card, i) => {
    const result = results[i];
    const split = currentAndUnpaid(result?.data ?? []);
    return { account: card, ...split, loading: result?.isPending ?? true };
  });
}
