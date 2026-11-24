import { useNavigate, useSearch } from "@tanstack/react-router";

import type { ResultsSearch } from "@/features/portfolio/results/results-search";

type SearchPatch = {
  [K in keyof ResultsSearch]?: ResultsSearch[K] | undefined;
};

// The search of the results route and the writer of its keys: a key set to `undefined` leaves the
// address, so every key is absent while it holds its default.
export function useResultsSearch(): [
  ResultsSearch,
  (patch: SearchPatch) => void,
] {
  const search = useSearch({ from: "/_authed/portfolio/results" });
  const navigate = useNavigate();

  function patch(next: SearchPatch) {
    const kept = Object.fromEntries(
      Object.entries({ ...search, ...next }).filter(
        ([, value]) => value !== undefined,
      ),
    );

    void navigate({ to: "/portfolio/results", search: kept, replace: true });
  }

  return [search, patch];
}
