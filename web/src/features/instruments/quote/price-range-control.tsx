import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import {
  type PriceRange,
  priceRanges,
} from "@/features/instruments/model/price-window";
import { useT } from "@/i18n/i18n-provider";

interface PriceRangeControlProps {
  value: PriceRange;
  onChange: (range: PriceRange) => void;
}

export function PriceRangeControl({ value, onChange }: PriceRangeControlProps) {
  const t = useT();

  return (
    <SegmentedControl
      size="sm"
      aria-label={t("instrument.range.label")}
      value={value}
      onValueChange={(next) => {
        const range = priceRanges.find((r) => r === next);
        if (range !== undefined) onChange(range);
      }}
    >
      {priceRanges.map((r) => (
        <Segment key={r} value={r}>
          {t(`instrument.range.${r}`)}
        </Segment>
      ))}
    </SegmentedControl>
  );
}
