import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import {
  curvesQuery,
  indexExpectationsQuery,
  indexRatesQuery,
  type MarketCurve,
} from "@/features/calculators/api";
import { indexDataOf } from "@/features/calculators/indexer-comparison/index-data";
import type { IndexData } from "@/features/calculators/indexer-comparison/security";
import { indexCurrency } from "@/features/calculators/rate-source/index-catalog";
import {
  useIndexList,
  windowStart,
  type Index,
} from "@/features/calculators/rate-source/use-index-rate";

// IC1, C3: the indexes with an expected path whose currency is the amount's; an index the
// catalog has no currency for is offered for any currency.
export function useComparableIndexes(currency: string): Index[] {
  return useComparableIndexList(currency).indexes;
}

// The comparable indexes with the state of the read of the index list.
export function useComparableIndexList(currency: string): {
  indexes: Index[];
  pending: boolean;
  failed: boolean;
} {
  const { indexes, pending, failed } = useIndexList();

  return {
    indexes: indexes.filter((i) => {
      const own = indexCurrency(i.id);
      return i.expected && (own === undefined || own === currency);
    }),
    pending,
    failed,
  };
}

// The rates and the expected path of each index, and the market curves.
export function useComparisonData(indexes: readonly Index[]): {
  data: Map<string, IndexData>;
  curves: MarketCurve[];
} {
  const api = useApi();
  const rates = useQueries({
    queries: indexes.map((i) =>
      indexRatesQuery(api, i.id, windowStart(i.last), i.last),
    ),
  });
  const surveys = useQueries({
    queries: indexes.map((i) => indexExpectationsQuery(api, i.id)),
  });
  const curves = useQuery(curvesQuery(api)).data ?? [];

  return { data: indexDataOf(indexes, rates, surveys), curves };
}
