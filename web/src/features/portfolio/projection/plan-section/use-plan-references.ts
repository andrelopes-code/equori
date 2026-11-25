import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  curvesQuery,
  indexesQuery,
  indexExpectationsQuery,
} from "@/features/calculators";
import {
  expectedInflation,
  longestRealRate,
} from "@/features/portfolio/projection/plan-section/plan-references";

// PX17: the stored market rates the premises are read against; each is null while it is not stored.
export function usePlanReferences(currency: string) {
  const api = useApi();

  const real = longestRealRate(useQuery(curvesQuery(api)).data ?? [], currency);
  const indexes = useQuery(indexesQuery(api)).data ?? [];
  const index = real?.index ?? "";
  const surveyed = indexes.some((i) => i.id === index && i.expected);
  const survey = useQuery({
    ...indexExpectationsQuery(api, index),
    enabled: surveyed,
  }).data;

  return {
    real,
    inflation: expectedInflation(index, survey?.points ?? []),
  };
}
