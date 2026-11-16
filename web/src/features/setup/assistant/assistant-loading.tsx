import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import card from "@/features/setup/assistant/assistant-card.module.css";
import status from "@/features/setup/assistant/assistant-status.module.css";
import providerStyles from "@/features/setup/assistant/provider-row.module.css";
import routeStyles from "@/features/setup/usage/use-route.module.css";
import usageStyles from "@/features/setup/usage/usage-details.module.css";

const cards = [
  { rows: 2, className: providerStyles.loading },
  { rows: 3, className: routeStyles.loading },
] as const;

// The pane while its providers and uses load, in the shape of the content (spec A13): the status,
// the two cards with their rows and the closed usage line.
export function AssistantLoading() {
  return (
    <SkeletonRegion>
      <div className={status.status}>
        <Skeleton shape="block" inlineSize="62%" blockSize={30} />
        <Skeleton shape="block" inlineSize="44%" blockSize={16} />
      </div>

      {cards.map((group) => (
        <div key={group.rows} className={card.card}>
          <div className={card.head}>
            <div className={card.title}>
              <Skeleton shape="block" inlineSize={120} blockSize={16} />
              <Skeleton shape="block" inlineSize={280} blockSize={14} />
            </div>
          </div>

          {Array.from({ length: group.rows }, (_, index) => (
            <div key={index} className={[card.row, group.className].join(" ")}>
              <Skeleton shape="block" inlineSize="55%" blockSize={14} />
            </div>
          ))}
        </div>
      ))}

      <div className={[card.card, usageStyles.summary].join(" ")}>
        <Skeleton shape="block" inlineSize={130} blockSize={14} />
      </div>
    </SkeletonRegion>
  );
}
