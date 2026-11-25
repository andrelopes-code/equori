import { TextField } from "@slotted/react/text-field";

interface UnitInputProps {
  unit: string;
  value: string;
  onChange: (text: string) => void;
  inputMode: "numeric" | "decimal";
}

// A number typed in the plan section with its unit at the end; the Field around it names it.
export function UnitInput({
  unit,
  value,
  onChange,
  inputMode,
}: UnitInputProps) {
  return (
    <TextField
      inputMode={inputMode}
      autoComplete="off"
      value={value}
      end={unit}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
