import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";

// Two groups is the smallest set a ledger with a card holds; more groups grow the strip.
const groups = ["first", "second"];

export function BalancesPlaceholder() {
  return (
    <SkeletonRegion>
      <FigureStrip>
        {groups.map((key) => (
          <FigureStripItem
            key={key}
            label={<Skeleton shape="text" inlineSize="5rem" />}
          >
            <Skeleton shape="text" inlineSize="9rem" />
          </FigureStripItem>
        ))}
      </FigureStrip>
    </SkeletonRegion>
  );
}
