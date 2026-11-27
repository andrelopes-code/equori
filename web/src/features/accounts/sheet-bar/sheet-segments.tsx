import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import type {
  GroupBy,
  Order,
} from "@/features/accounts/balance-sheet/sheet-layout";
import { GroupControl } from "@/features/accounts/sheet-bar/group-control";
import { OrderControl } from "@/features/accounts/sheet-bar/order-control";
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
        <GroupControl value={group} onChange={onGroupChange} />
      </Inline>

      <Inline gap={4} wrap="nowrap" align="center">
        <Text size="sm" tone="muted">
          {t("balanceSheet.order")}
        </Text>
        <OrderControl value={order} onChange={onOrderChange} />
      </Inline>
    </Inline>
  );
}
