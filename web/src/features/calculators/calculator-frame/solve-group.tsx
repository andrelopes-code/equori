import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupDescription,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

interface SolveGroupProps<T extends string> {
  legend: string;
  // What the chosen answer is, in one sentence, under the legend.
  hint: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// What to calculate: the question with its choices at the width of their labels (forms F3, F6).
export function SolveGroup<T extends string>({
  legend,
  hint,
  choices,
  value,
  onChange,
}: SolveGroupProps<T>) {
  function handleValueChange(next: string) {
    const choice = choices.find((c) => c.value === next);
    if (choice !== undefined) onChange(choice.value);
  }

  return (
    <FieldGroup kind="question" necessity="none">
      <FieldGroupLegend>{legend}</FieldGroupLegend>
      <FieldGroupDescription>{hint}</FieldGroupDescription>
      <FieldGroupContent>
        <Inline>
          <SegmentedControl
            aria-label={legend}
            value={value}
            onValueChange={handleValueChange}
          >
            {choices.map((c) => (
              <Segment key={c.value} value={c.value}>
                {c.label}
              </Segment>
            ))}
          </SegmentedControl>
        </Inline>
      </FieldGroupContent>
    </FieldGroup>
  );
}
