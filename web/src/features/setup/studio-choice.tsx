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
}

// One value of a short closed set, as segments across the panel.
export function StudioChoice<T extends string>({
  label,
  hint,
  values,
  value,
  text,
  onChange,
}: StudioChoiceProps<T>) {
  return (
    <StudioField label={label} description={hint}>
      <SegmentedControl
        aria-label={label}
        size="sm"
        fullWidth
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
