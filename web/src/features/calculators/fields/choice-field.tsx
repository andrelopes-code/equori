import { Field, FieldDescription } from "@slotted/react/field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import { FieldTitle } from "@/ui/form-fields/field-title";

// An exclusive choice among two to four short options, all in view: what to calculate, the
// kind of a security, when the first installment falls due.
export function ChoiceField<T extends string>({
  label,
  hint,
  help,
  choices,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  // The definition of the term, beside the label (F8).
  help?: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Field necessity="none">
      <FieldTitle label={label} {...(help === undefined ? {} : { help })} />
      <SegmentedControl
        value={value}
        fullWidth
        onValueChange={(next) => {
          const choice = choices.find((c) => c.value === next);
          if (choice !== undefined) onChange(choice.value);
        }}
      >
        {choices.map((c) => (
          <Segment key={c.value} value={c.value}>
            {c.label}
          </Segment>
        ))}
      </SegmentedControl>
      {hint !== undefined && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}
