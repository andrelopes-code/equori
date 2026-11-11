import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type { CategoryView } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";

// Chooses when the totals count an amount (G1): a two-value choice read at a glance, so a
// segmented control rather than a select.
export function CategoryViewControl({
  value,
  onChange,
}: {
  value: CategoryView;
  onChange: (view: CategoryView) => void;
}) {
  const t = useT();
  return (
    <SegmentedControl
      aria-label={t("view.label")}
      value={value}
      onValueChange={(next) => {
        onChange(next === "cash" ? "cash" : "accrual");
      }}
    >
      <Segment value="accrual">{t("view.accrual")}</Segment>
      <Segment value="cash">{t("view.cash")}</Segment>
    </SegmentedControl>
  );
}
