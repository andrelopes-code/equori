import type { components } from "@/api/schema.gen";
import type { FeedControls } from "@/features/setup/market-data/feed-controls";
import { MarketDataFeedRow } from "@/features/setup/market-data/market-data-feed-row";

interface MarketDataFeedsProps {
  feeds: readonly components["schemas"]["MarketDataFeed"][];
  controls: FeedControls;
}

const kindOrder = {
  price: 0,
  index: 1,
  expectation: 2,
  curve: 3,
  sentiment: 4,
  institution: 5,
  fund_report: 6,
  company_report: 7,
} as const;

// The rows of a region: prices, then indexes, expectations, curves, sentiments, institutions, fund reports
// and company reports.
export function MarketDataFeeds({ feeds, controls }: MarketDataFeedsProps) {
  const ordered = [...feeds].sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind],
  );

  return ordered.map((feed) => (
    <MarketDataFeedRow key={feed.id} feed={feed} controls={controls} />
  ));
}
