import type { components } from "@/api/schema.gen";
import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import { summarizeFeeds } from "@/features/setup/market-data/feed-status";
import styles from "@/features/setup/market-data/market-data.module.css";
import { MarketDataRegion } from "@/features/setup/market-data/market-data-region";
import { RegionBand } from "@/features/setup/market-data/region-band";
import { othersSummary } from "@/features/setup/market-data/region-verdict";
import { useOpenedOnce } from "@/features/setup/market-data/use-opened-once";
import type { RegionGroup } from "@/features/setup/model/region-groups";
import { useT } from "@/i18n/i18n-provider";

interface MarketDataOthersProps {
  groups: readonly RegionGroup<components["schemas"]["MarketDataFeed"]>[];
  controls: FeedControls;
}

// The regions that are neither the book's nor global, under one fold. Its band holds text only: a
// flag per region would repeat the flags inside it and grow with every region added.
export function MarketDataOthers({ groups, controls }: MarketDataOthersProps) {
  const t = useT();
  const summaries = groups.map((g) => summarizeFeeds(g.items));
  const open = summaries.some((s) => s.problems > 0);
  const { opened, onToggle } = useOpenedOnce(open);

  if (groups.length === 0) return null;

  return (
    <details className={styles.fold} open={open} onToggle={onToggle}>
      <summary>
        <RegionBand
          region={null}
          title={t("marketData.others")}
          line={othersSummary(summaries, t)}
          folded
        />
      </summary>

      {opened &&
        groups.map((g) => (
          <MarketDataRegion
            key={g.region}
            region={g.region}
            feeds={g.items}
            home={false}
            folded
            controls={controls}
          />
        ))}
    </details>
  );
}
