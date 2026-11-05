import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type { RecordFilter } from "@/features/accounts/batch-search";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const filterWords: Record<RecordFilter, MessageKey> = {
  needs_review: "batch.filter.needs_review",
  all: "batch.filter.all",
  matched: "batch.filter.matched",
  created: "batch.filter.created",
  discarded: "batch.filter.discarded",
  withdrawn: "batch.filter.withdrawn",
};

interface RecordFilterControlProps {
  filter: RecordFilter;
  filters: RecordFilter[];
  needsReview: number | undefined;
  onChange: (filter: RecordFilter) => void;
}

export function RecordFilterControl({
  filter,
  filters,
  needsReview,
  onChange,
}: RecordFilterControlProps) {
  const t = useT();

  return (
    <div>
      <SegmentedControl
        size="sm"
        aria-label={t("batch.filter")}
        value={filter}
        onValueChange={(value) => {
          const next = filters.find((f) => f === value);
          if (next !== undefined) onChange(next);
        }}
      >
        {filters.map((f) => (
          <Segment key={f} value={f}>
            {f === "needs_review" && needsReview !== undefined
              ? t("batch.filter.needs_reviewCount", { count: needsReview })
              : t(filterWords[f])}
          </Segment>
        ))}
      </SegmentedControl>
    </div>
  );
}
