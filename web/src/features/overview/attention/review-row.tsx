import { Text } from "@slotted/react/typography";

import type {
  ReviewItem,
  ReviewSegment,
} from "@/features/overview/attention/attention";
import { segmentDestination } from "@/features/overview/attention/attention-destination";
import styles from "@/features/overview/attention/attention.module.css";
import { AttentionRow } from "@/features/overview/attention/attention-row";
import { reviewGroups } from "@/features/overview/attention/review-groups";
import { ReviewLegend } from "@/features/overview/attention/review-legend";
import type { ReviewLegendEntry } from "@/features/overview/attention/review-legend";
import { SegmentBar } from "@/features/overview/attention/segment-bar";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";

// The transactions that wait for a decision, as one count with its sources drawn as a strip. Each
// source in the legend leads to where it is resolved.
export function ReviewRow({ item }: { item: ReviewItem }) {
  const t = useT();
  const [locale] = useAppLocale();
  const number = numberFormatter(locale);
  const groups = reviewGroups(item.segments);
  const entries: ReviewLegendEntry[] = groups.map((group) => {
    const [first] = group.segments;
    const single = group.segments.length === 1 ? first : undefined;

    return {
      label:
        single === undefined
          ? t("overview.attention.reviewOther")
          : legendLabel(single, t),
      count: number.format(group.count),
      to:
        single === undefined ? { to: "/accounts" } : segmentDestination(single),
    };
  });
  const total = item.more
    ? t("overview.attention.atLeast", { count: number.format(item.total) })
    : number.format(item.total);

  return (
    <AttentionRow
      title={
        <span className={styles.head}>
          <span>{t("overview.attention.review")}</span>

          <Text tone="default" weight="semibold" numeric="tabular">
            {total}
          </Text>
        </span>
      }
      line={
        <span className={styles.review}>
          <SegmentBar
            groups={groups}
            label={entries.map((e) => `${e.label} ${e.count}`).join(", ")}
          />

          <ReviewLegend entries={entries} />
        </span>
      }
    />
  );
}

function legendLabel(segment: ReviewSegment, t: TFunction): string {
  return segment.kind === "uncategorized"
    ? t("overview.attention.reviewUncategorized")
    : segment.account.name;
}
