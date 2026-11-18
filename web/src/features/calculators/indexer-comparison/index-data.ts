import type { IndexData } from "@/features/calculators/indexer-comparison/security";
import { dailySpread } from "@/features/calculators/rate-source/index-catalog";
import type { IndexRate } from "@/features/calculators/rate-source/index-rates";

interface SettledQuery<T> {
  data: T | undefined;
  isPending: boolean;
}

interface Survey {
  surveyDate: string;
  points: IndexRate[];
}

// What the comparison knows of each index once its rates and its survey have settled; an index
// whose survey failed has no points. An index still loading is left out, so no figure shows
// before its data is complete.
export function indexDataOf(
  indexes: readonly { id: string; period: "day" | "month" }[],
  rates: readonly SettledQuery<IndexRate[]>[],
  surveys: readonly SettledQuery<Survey>[],
): Map<string, IndexData> {
  const out = new Map<string, IndexData>();

  indexes.forEach((index, i) => {
    const stored = rates[i]?.data;
    const survey = surveys[i];
    if (stored === undefined || survey === undefined || survey.isPending)
      return;

    out.set(index.id, {
      id: index.id,
      period: index.period,
      rates: stored,
      points: survey.data?.points ?? [],
      surveyDate: survey.data?.surveyDate ?? "",
      dailySpread: dailySpread(index.id),
    });
  });

  return out;
}
