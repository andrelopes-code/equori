import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type { GroupBy } from "@/features/accounts/balance-sheet/sheet-layout";
import { useT } from "@/i18n/i18n-provider";

interface GroupControlProps {
  value: GroupBy;
  // A phone's sheet: the segments spread across the line.
  compact?: boolean;
  onChange: (group: GroupBy) => void;
}

export function GroupControl({ value, compact, onChange }: GroupControlProps) {
  const t = useT();

  return (
    <SegmentedControl
      aria-label={t("balanceSheet.groupBy")}
      fullWidth={compact}
      value={value}
      onValueChange={(next) => {
        if (next === "kind" || next === "institution" || next === "none") {
          onChange(next);
        }
      }}
    >
      <Segment value="kind">{t("balanceSheet.groupKind")}</Segment>
      <Segment value="institution">
        {t("balanceSheet.groupInstitution")}
      </Segment>
      <Segment value="none">{t("balanceSheet.groupNone")}</Segment>
    </SegmentedControl>
  );
}
