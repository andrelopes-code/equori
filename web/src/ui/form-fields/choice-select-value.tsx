import { SelectValue } from "@slotted/react/select";

import type { Choice } from "@/ui/form-fields/choice-select";
import { RegionLabel } from "@/ui/region/region-label";

interface ChoiceSelectValueProps {
  choices: readonly Choice[];
  placeholder: string | undefined;
}

// What a closed select shows: the label of the choice, behind the flag when the choice has one. A
// select with no flag on any choice keeps the family's own summary.
export function ChoiceSelectValue({
  choices,
  placeholder,
}: ChoiceSelectValueProps) {
  const placeholderProps = placeholder === undefined ? {} : { placeholder };

  if (choices.every((c) => c.flag === undefined))
    return <SelectValue {...placeholderProps} />;

  return (
    <SelectValue {...placeholderProps}>
      {(values, labels) => {
        const flag = choices.find((c) => c.value === values[0])?.flag;

        return flag === undefined ? (
          labels.join(", ")
        ) : (
          <RegionLabel region={flag}>{labels[0]}</RegionLabel>
        );
      }}
    </SelectValue>
  );
}
