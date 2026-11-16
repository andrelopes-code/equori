import type { components } from "@/api/schema.gen";
import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import { feedRegion } from "@/features/setup/market-data/feed-region";
import styles from "@/features/setup/market-data/market-data.module.css";
import { MarketDataOthers } from "@/features/setup/market-data/market-data-others";
import { MarketDataRegion } from "@/features/setup/market-data/market-data-region";
import { groupByRegion } from "@/features/setup/model/region-groups";

interface MarketDataRegionsProps {
  feeds: readonly components["schemas"]["MarketDataFeed"][];
  // The book's region code.
  home: string | undefined;
  controls: FeedControls;
}

// The feeds on one surface, ordered by relevance: the book's region, the global group, then the
// other regions under one disclosure.
export function MarketDataRegions({
  feeds,
  home,
  controls,
}: MarketDataRegionsProps) {
  const groups = groupByRegion(feeds, (f) => feedRegion(f.id), home);

  return (
    <div className={styles.surface}>
      {groups.home !== null && (
        <MarketDataRegion
          region={groups.home.region}
          feeds={groups.home.items}
          home
          folded={false}
          controls={controls}
        />
      )}

      {groups.global !== null && (
        <MarketDataRegion
          region={groups.global.region}
          feeds={groups.global.items}
          home={false}
          folded={false}
          controls={controls}
        />
      )}

      <MarketDataOthers groups={groups.others} controls={controls} />
    </div>
  );
}
