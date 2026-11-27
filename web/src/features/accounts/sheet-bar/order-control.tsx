import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type { Order } from "@/features/accounts/balance-sheet/sheet-layout";
import { useT } from "@/i18n/i18n-provider";

interface OrderControlProps {
  value: Order;
  // A phone's sheet: the segments spread across the line.
  compact?: boolean;
  onChange: (order: Order) => void;
}

export function OrderControl({ value, compact, onChange }: OrderControlProps) {
  const t = useT();

  return (
    <SegmentedControl
      aria-label={t("balanceSheet.order")}
      fullWidth={compact}
      value={value}
      onValueChange={(next) => {
        if (next === "balance" || next === "name" || next === "attention") {
          onChange(next);
        }
      }}
    >
      <Segment value="balance">{t("balanceSheet.orderBalance")}</Segment>
      <Segment value="name">{t("balanceSheet.orderName")}</Segment>
      {/* Three equal segments on a phone leave no room for the whole words. */}
      <Segment value="attention">
        {t(
          compact
            ? "balanceSheet.orderAttentionShort"
            : "balanceSheet.orderAttention",
        )}
      </Segment>
    </SegmentedControl>
  );
}
