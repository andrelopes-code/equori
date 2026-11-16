import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";

import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import styles from "@/features/setup/market-data/market-data.module.css";
import { summarizeFeeds } from "@/features/setup/market-data/feed-status";
import { MarketDataRegion } from "@/features/setup/market-data/market-data-region";
import { othersSummary } from "@/features/setup/market-data/region-verdict";
import type { RegionGroup } from "@/features/setup/model/region-groups";
import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";

interface MarketDataOthersProps {
  groups: readonly RegionGroup<components["schemas"]["MarketDataFeed"]>[];
  controls: FeedControls;
}

// The regions that are neither the book's nor global, under one disclosure. Its header holds text
// only: a flag per region would repeat the flags inside it and grow with every region added.
export function MarketDataOthers({ groups, controls }: MarketDataOthersProps) {
  const t = useT();
  const summaries = groups.map((g) => summarizeFeeds(g.items));
  const problems = summaries.some((s) => s.problems > 0);

  if (groups.length === 0) return null;

  return (
    <Collapsible variant="ruled" defaultOpen={problems} mount="lazy">
      <CollapsibleHeader>
        <CollapsibleTrigger>
          <span className={styles.regionText}>
            <span className={styles.regionName}>{t("marketData.others")}</span>

            <span className={styles.regionSummary}>
              {othersSummary(summaries, t)}
            </span>
          </span>
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        {groups.map((g) => (
          <MarketDataRegion
            key={g.region}
            region={g.region}
            feeds={g.items}
            home={false}
            controls={controls}
          />
        ))}
      </CollapsiblePanel>
    </Collapsible>
  );
}
