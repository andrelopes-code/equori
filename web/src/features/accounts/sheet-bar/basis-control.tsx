import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type { Basis } from "@/features/accounts/sheet-bar/sheet-bar-props";
import { useT } from "@/i18n/i18n-provider";

interface BasisControlProps {
  value: Basis;
  // A phone's sheet: the segments spread across the line.
  compact?: boolean;
  onChange: (basis: Basis) => void;
}

// With the pending transactions, or the cleared ones only.
export function BasisControl({ value, compact, onChange }: BasisControlProps) {
  const t = useT();

  return (
    <SegmentedControl
      aria-label={t("balanceSheet.basis")}
      fullWidth={compact}
      value={value}
      onValueChange={(next) => {
        if (next === "booked" || next === "settled") onChange(next);
      }}
    >
      <Segment value="booked">{t("balanceSheet.booked")}</Segment>
      <Segment value="settled">{t("balanceSheet.settled")}</Segment>
    </SegmentedControl>
  );
}
