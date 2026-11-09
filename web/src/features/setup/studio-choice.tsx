import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { oneOf } from "@/features/setup/one-of";
import { StudioField } from "@/features/setup/studio-field";

export interface StudioChoiceProps<T extends string> {
  label: string;
  hint?: string;
  values: readonly T[];
  value: T;
  text: (value: T) => string;
  onChange: (value: T) => void;
  // Workaround for Slotted issue #87: a set whose labels clip across the panel in any language
  // is stacked by its caller, since no condense mode stacks the segments when they do not fit.
  orientation?: "horizontal" | "vertical";
}

// One value of a short closed set, as segments across the panel.
export function StudioChoice<T extends string>({
  label,
  hint,
  values,
  value,
  text,
  onChange,
  orientation = "horizontal",
}: StudioChoiceProps<T>) {
  return (
    <StudioField label={label} description={hint}>
      <SegmentedControl
        aria-label={label}
        size="sm"
        fullWidth
        orientation={orientation}
        value={value}
        onValueChange={(next) => {
          if (oneOf(values, next)) onChange(next);
        }}
      >
        {values.map((v) => (
          <Segment key={v} value={v}>
            {text(v)}
          </Segment>
        ))}
      </SegmentedControl>
    </StudioField>
  );
}
