import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";

import { phoneCardTabs } from "@/features/cards/card-search";
import type { CardSearch, CardTab } from "@/features/cards/card-search";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// The tab a card's page marks and the one its region renders, and the moves that write the address.
export function useCardTabs(accountId: string, search: CardSearch) {
  const navigate = useNavigate();
  const compact = useMediaQuery(compactQuery);

  const asked: CardTab = search.tab ?? "statements";
  const tab: CardTab =
    compact && !phoneCardTabs.includes(asked) ? "statements" : asked;
  const [chosen, setChosen] = useState<CardTab | null>(null);
  const shown = useDeferredValue(chosen ?? tab);

  const marked = chosen ?? tab;

  function go(next: { tab?: CardTab; rule?: true; from?: string }) {
    const merged: CardSearch = { ...search };
    if (next.tab !== undefined) {
      delete merged.tab;
      delete merged.rule;
      if (next.tab !== "statements") merged.tab = next.tab;
    }

    if (next.rule === true) merged.rule = true;

    if (next.from !== undefined) merged.from = next.from;

    void navigate({
      to: "/cards/$accountId",
      params: { accountId },
      search: merged,
      replace: true,
    }).then(() => {
      setChosen(null);
    });
  }

  function select(next: CardTab, rule?: true) {
    setChosen(next);
    go(rule === undefined ? { tab: next } : { tab: next, rule });
  }

  function earlier(from: string) {
    go({ from });
  }

  return {
    marked,
    shown,
    refreshing: shown !== marked,
    select,
    earlier,
  };
}
