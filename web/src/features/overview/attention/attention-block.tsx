import { Text } from "@slotted/react/typography";

import { attentionCount } from "@/features/overview/attention/attention";
import { AttentionList } from "@/features/overview/attention/attention-list";
import { useAttention } from "@/features/overview/attention/use-attention";
import { OverviewBlock } from "@/features/overview/overview-block/overview-block";
import type { Placement } from "@/features/overview/overview-block/overview-block";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// What waits for a decision, ranked by impact. The widget keeps its cell when nothing does.
export function AttentionBlock(placement: Placement) {
  const t = useT();
  const month = useToday().slice(0, 7);
  const { items, loading, error, retry } = useAttention();
  const count = attentionCount(items);

  return (
    <OverviewBlock
      placement={placement}
      loading={loading && error === null}
      error={error}
      // The widget keeps its cell when nothing needs attention, so the grid holds no hole.
      empty={items.length === 0 ? t("overview.attention.empty") : undefined}
      onRetry={retry}
      meta={
        count > 0 && (
          <Text size="sm" tone="muted" numeric="tabular">
            {count === 1
              ? t("overview.attention.countOne")
              : t("overview.attention.count", { count })}
          </Text>
        )
      }
    >
      <AttentionList
        items={items}
        month={month}
        label={t("overview.attention.title")}
      />
    </OverviewBlock>
  );
}
