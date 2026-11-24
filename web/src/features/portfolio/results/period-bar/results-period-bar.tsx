import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { periodRange } from "@/features/portfolio/results/model/results-period";
import styles from "@/features/portfolio/results/period-bar/results-period-bar.module.css";
import { resultsPeriods } from "@/features/portfolio/results/results-search";
import { useResultsSearch } from "@/features/portfolio/results/use-results-search";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { PeriodControl } from "@/ui/navigation/period-control";
import type { Period } from "@/ui/navigation/period-control";

const wholeHistory = "all";

// PR1: the seven presets and the whole history as one choice, then the custom range. The choice
// lives in the search: `period` for a preset, `from` and `to` for a range.
export function ResultsPeriodBar() {
  const t = useT();
  const today = useToday();
  const [search, patch] = useResultsSearch();

  const custom = search.from !== undefined && search.to !== undefined;
  const chosen = custom ? "" : (search.period ?? wholeHistory);
  const { from, to } = periodRange(search.period, today);
  const range =
    search.from !== undefined && search.to !== undefined
      ? { from: search.from, to: search.to }
      : from === undefined
        ? undefined
        : { from, to };

  function handlePreset(value: string) {
    patch({
      period: resultsPeriods.find((p) => p === value),
      from: undefined,
      to: undefined,
    });
  }

  function handleRange(next: Period | undefined) {
    patch({ period: undefined, from: next?.from, to: next?.to });
  }

  return (
    <div className={styles.periodBar}>
      <SegmentedControl
        aria-label={t("portfolio.results.period")}
        value={chosen}
        onValueChange={handlePreset}
      >
        {resultsPeriods.map((period) => (
          <Segment key={period} value={period}>
            {t(`portfolio.results.period.${period}`)}
          </Segment>
        ))}

        <Segment value={wholeHistory}>
          {t("portfolio.results.period.all")}
        </Segment>
      </SegmentedControl>

      <PeriodControl value={range} onChange={handleRange} />
    </div>
  );
}
