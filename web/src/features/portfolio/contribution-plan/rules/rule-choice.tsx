import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

interface RuleChoiceProps {
  legend: string;
  choices: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

// A question of the rule dialog answered by one of a few short words, all in view.
export function RuleChoice({
  legend,
  choices,
  value,
  onChange,
}: RuleChoiceProps) {
  return (
    <FieldGroup>
      <FieldGroupLegend>{legend}</FieldGroupLegend>
      <FieldGroupContent>
        <SegmentedControl value={value} onValueChange={onChange}>
          {choices.map((choice) => (
            <Segment key={choice.value} value={choice.value}>
              {choice.label}
            </Segment>
          ))}
        </SegmentedControl>
      </FieldGroupContent>
    </FieldGroup>
  );
}
