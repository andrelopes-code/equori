import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import type { HelpLibrary } from "@/features/help/model/help-library";
import { searchHelp } from "@/features/help/search/search-help";
import type {
  HelpHit,
  HelpSearchResult,
} from "@/features/help/search/search-help";

interface HelpSearchState {
  result: HelpSearchResult;
  active: HelpHit | undefined;
  setQuery: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

// The search of the index: the query lives in the address, the arrow keys move through the
// results, Enter opens the one they stand on and Escape clears (help spec, HP9, HP10).
export function useHelpSearch(
  library: HelpLibrary | undefined,
  query: string,
): HelpSearchState {
  const navigate = useNavigate();
  const [place, setPlace] = useState(0);

  const result = useMemo(
    () => searchHelp(library ?? [], query),
    [library, query],
  );
  const hits = [
    ...(result.best === null ? [] : [result.best]),
    ...result.groups.flatMap((g) => g.hits),
  ];
  const active = hits[Math.min(place, hits.length - 1)];

  const setQuery = (next: string) => {
    setPlace(0);
    void navigate({
      to: "/help",
      search: next === "" ? {} : { q: next },
      replace: true,
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : -1;

      event.preventDefault();
      setPlace(Math.max(0, Math.min(hits.length - 1, place + step)));
    } else if (event.key === "Enter" && active !== undefined) {
      event.preventDefault();
      void navigate({
        to: "/help/$page",
        params: { page: active.page },
        ...(active.hash === undefined ? {} : { hash: active.hash }),
      });
    } else if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      setQuery("");
    }
  };

  return { result, active, setQuery, onKeyDown };
}
