import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";

export interface Choice {
  value: string;
  label: string;
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
  onChange,
}: {
  label: string;
  choices: readonly Choice[];
  value: string | readonly string[] | null;
  multiple: boolean;
  invalid?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  onChange: (value: string | string[] | null) => void;
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
    >
      <SelectTrigger aria-label={label}>
        <SelectValue {...(placeholder === undefined ? {} : { placeholder })} />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
