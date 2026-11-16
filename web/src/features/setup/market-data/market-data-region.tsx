import { Tag } from "@slotted/react/tag";

import type { components } from "@/api/schema.gen";
import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import { summarizeFeeds } from "@/features/setup/market-data/feed-status";
import styles from "@/features/setup/market-data/market-data.module.css";
import { MarketDataFeeds } from "@/features/setup/market-data/market-data-feeds";
import { RegionBand } from "@/features/setup/market-data/region-band";
import {
  regionLine,
  regionVerdict,
} from "@/features/setup/market-data/region-verdict";
import { useOpenedOnce } from "@/features/setup/market-data/use-opened-once";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { regionName } from "@/ui/region/region-name";

interface MarketDataRegionProps {
  region: string;
  feeds: readonly components["schemas"]["MarketDataFeed"][];
  // The book's region: it carries the "Your region" tag.
  home: boolean;
  // A folded region opens on its band, or on its own when a feed has a problem.
  folded: boolean;
  controls: FeedControls;
}

// A region: its band over its rows. The book's region and the global one stand open; the others
// fold. The band is the page's own (region-band.tsx).
export function MarketDataRegion({
  region,
  feeds,
  home,
  folded,
  controls,
}: MarketDataRegionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const summary = summarizeFeeds(feeds);
  const open = summary.problems > 0;
  const { opened, onToggle } = useOpenedOnce(open);
  const line = regionLine(summary, t);
  const band = (
    <RegionBand
      region={region}
      title={regionName(region, t, tag)}
      tag={
        home && (
          <Tag size="sm" tone="accent">
            {t("region.yours")}
          </Tag>
        )
      }
      line={region === "global" ? `${line} · ${t("region.globalHint")}` : line}
      verdict={regionVerdict(summary, t)}
      folded={folded}
      sub={folded}
    />
  );

  if (!folded)
    return (
      <>
        {band}
        <MarketDataFeeds feeds={feeds} controls={controls} />
      </>
    );

  return (
    <details className={styles.fold} open={open} onToggle={onToggle}>
      <summary>{band}</summary>

      {opened && <MarketDataFeeds feeds={feeds} controls={controls} />}
    </details>
  );
}
