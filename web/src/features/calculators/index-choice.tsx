import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { indexName } from "@/features/calculators/index-catalog";

// No index id matches it: ids are ^[a-z0-9_]{2,40}$.
const typed = "-";

// The source of a rate: typed by the reader (none), or one of the indexes this instance stores.
// A segmented control shows every choice at once; an instance stores few indexes.
export function IndexChoice({
  label,
  hint,
  none,
  indexes,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  // The words of the choice that takes no index.
  none: string;
  indexes: readonly { id: string }[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SegmentedControl
        value={value ?? typed}
        onValueChange={(next) => {
          onChange(next === typed ? undefined : next);
        }}
      >
        <Segment value={typed}>{none}</Segment>
        {indexes.map((i) => (
          <Segment key={i.id} value={i.id}>
            {indexName(i.id)}
          </Segment>
        ))}
      </SegmentedControl>
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
