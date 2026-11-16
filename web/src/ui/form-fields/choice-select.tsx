import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@slotted/react/select";
import { Fragment } from "react";

import { ChoiceSelectValue } from "@/ui/form-fields/choice-select-value";
import { RegionLabel } from "@/ui/region/region-label";

export interface Choice {
  value: string;
  label: string;
  // Choices that follow each other with the same group stand under one heading.
  group?: string;
  // A region code or "global": its flag stands beside the label.
  flag?: string;
}

function sections(choices: readonly Choice[]) {
  const out: { group: string | undefined; choices: Choice[] }[] = [];
  for (const choice of choices) {
    const last = out[out.length - 1];
    if (last !== undefined && last.group === choice.group)
      last.choices.push(choice);
    else out.push({ group: choice.group, choices: [choice] });
  }
  return out;
}

// One select for a value or a list of values from a fixed set of choices.
export function ChoiceSelect({
  label,
  choices,
  value,
  multiple,
  invalid,
  readOnly,
  placeholder,
  search,
  onChange,
  className,
}: {
  label: string;
  choices: readonly Choice[];
  value: string | readonly string[] | null;
  multiple: boolean;
  invalid?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  // A search field at the top of the list, for a long set.
  search?: boolean;
  onChange: (value: string | string[] | null) => void;
  // A width step of ui/field-width (docs/contributing/forms.md, F3).
  className?: string | undefined;
}) {
  return (
    <Select
      multiple={multiple}
      value={multiple ? [...((value ?? []) as readonly string[])] : value}
      onValueChange={(next) => {
        onChange(typeof next === "string" || next === null ? next : [...next]);
      }}
      {...(invalid === undefined ? {} : { invalid })}
      {...(readOnly === undefined ? {} : { readOnly })}
      {...(search === undefined ? {} : { search })}
    >
      <SelectTrigger
        aria-label={label}
        {...(className === undefined ? {} : { className })}
      >
        <ChoiceSelectValue choices={choices} placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {sections(choices).map((section, index) => {
          const items = section.choices.map((choice) => (
            <SelectItem
              key={choice.value}
              value={choice.value}
              textValue={choice.label}
            >
              {choice.flag === undefined ? (
                choice.label
              ) : (
                <RegionLabel region={choice.flag}>{choice.label}</RegionLabel>
              )}
            </SelectItem>
          ));
          return section.group === undefined ? (
            <Fragment key={index}>{items}</Fragment>
          ) : (
            <SelectGroup key={section.group} label={section.group}>
              {items}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
