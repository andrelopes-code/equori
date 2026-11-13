import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";

import type {
  GroupBy,
  Order,
} from "@/features/accounts/balance-sheet/sheet-layout";
import { useT } from "@/i18n/i18n-provider";

interface SheetSegmentsProps {
  group: GroupBy;
  order: Order;
  onGroupChange: (group: GroupBy) => void;
  onOrderChange: (order: Order) => void;
}

// The grouping and the order of the list as two segmented controls, each with its words.
export function SheetSegments({
  group,
  order,
  onGroupChange,
  onOrderChange,
}: SheetSegmentsProps) {
  const t = useT();

  return (
    <Inline gap={7} wrap="wrap" align="center">
      <Inline gap={4} wrap="nowrap" align="center">
        <Text size="sm" tone="muted">
          {t("balanceSheet.groupBy")}
        </Text>
        <SegmentedControl
          aria-label={t("balanceSheet.groupBy")}
          value={group}
          onValueChange={(value) => {
            if (
              value === "kind" ||
              value === "institution" ||
              value === "none"
            ) {
              onGroupChange(value);
            }
          }}
        >
          <Segment value="kind">{t("balanceSheet.groupKind")}</Segment>
          <Segment value="institution">
            {t("balanceSheet.groupInstitution")}
          </Segment>
          <Segment value="none">{t("balanceSheet.groupNone")}</Segment>
        </SegmentedControl>
      </Inline>

      <Inline gap={4} wrap="nowrap" align="center">
        <Text size="sm" tone="muted">
          {t("balanceSheet.order")}
        </Text>
        <SegmentedControl
          aria-label={t("balanceSheet.order")}
          value={order}
          onValueChange={(value) => {
            if (
              value === "balance" ||
              value === "name" ||
              value === "attention"
            ) {
              onOrderChange(value);
            }
          }}
        >
          <Segment value="balance">{t("balanceSheet.orderBalance")}</Segment>
          <Segment value="name">{t("balanceSheet.orderName")}</Segment>
          <Segment value="attention">
            {t("balanceSheet.orderAttention")}
          </Segment>
        </SegmentedControl>
      </Inline>
    </Inline>
  );
}
