import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { formatBasisPoints, formatDate } from "@/i18n/format";
import type { useT } from "@/i18n/i18n-provider";

type ReturnBenchmark = components["schemas"]["ReturnBenchmark"];

// The note of the 12-month yield figure: the percent of the index, the index's own rate a year
// and the days compared, the parts the comparison defines, joined by a middle dot.
export function yieldNote(
  benchmark: ReturnBenchmark,
  t: ReturnType<typeof useT>,
  tag: string,
): string {
  const index = indexName(benchmark.index);
  const rate = (bp: number) => formatBasisPoints(bp, tag);
  const parts: string[] = [];

  if (benchmark.percent_bp !== undefined) {
    parts.push(
      t("portfolio.yield.ofIndex", {
        percent: rate(benchmark.percent_bp),
        index,
      }),
    );
  }

  if (benchmark.index_annual_bp !== undefined) {
    parts.push(
      t("portfolio.yield.indexAnnual", {
        index,
        rate: rate(benchmark.index_annual_bp),
      }),
    );
  }

  parts.push(
    t("portfolio.yield.window", {
      from: formatDate(benchmark.from, tag),
      until: formatDate(benchmark.until, tag),
    }),
  );

  return parts.join(" · ");
}
