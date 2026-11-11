import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

// An exclusive choice among two to four short options, all in view: what to calculate, the
// kind of a security, when the first installment falls due.
export function ChoiceField<T extends string>({
  label,
  hint,
  choices,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Field necessity="none">
      <FieldLabel>{label}</FieldLabel>
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
