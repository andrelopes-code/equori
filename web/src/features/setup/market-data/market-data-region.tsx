import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Tag } from "@slotted/react/tag";

import type { components } from "@/api/schema.gen";
import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import { summarizeFeeds } from "@/features/setup/market-data/feed-status";
import styles from "@/features/setup/market-data/market-data.module.css";
import { MarketDataFeeds } from "@/features/setup/market-data/market-data-feeds";
import {
  regionSummary,
  regionVerdict,
} from "@/features/setup/market-data/region-verdict";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { RegionFlag } from "@/ui/region/region-flag";
import { regionName } from "@/ui/region/region-name";

interface MarketDataRegionProps {
  region: string;
  feeds: readonly components["schemas"]["MarketDataFeed"][];
  // The book's region: it opens and carries the "Your region" tag.
  home: boolean;
  controls: FeedControls;
}

// Families read: collapsible, section, accordion. A collapsible draws the header, the trigger and
// the panel; the flag, the tag and the verdict sit in its label.
export function MarketDataRegion({
  region,
  feeds,
  home,
  controls,
}: MarketDataRegionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const summary = summarizeFeeds(feeds);
  const verdict = regionVerdict(summary, t);
  const open = home || region === "global" || summary.problems > 0;

  return (
    <Collapsible variant="ruled" defaultOpen={open} mount="lazy">
      <CollapsibleHeader>
        <CollapsibleTrigger>
          <span className={styles.regionTitle}>
            <RegionFlag region={region} size="lg" />

            <span className={styles.regionText}>
              <span className={styles.regionName}>
                {regionName(region, t, tag)}
                {home && (
                  <Tag size="sm" tone="accent">
                    {t("region.yours")}
                  </Tag>
                )}
              </span>

              <span className={styles.regionSummary} data-tone={verdict.tone}>
                {regionSummary(summary, t)}
              </span>
            </span>
          </span>
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <MarketDataFeeds feeds={feeds} controls={controls} />
      </CollapsiblePanel>
    </Collapsible>
  );
}
