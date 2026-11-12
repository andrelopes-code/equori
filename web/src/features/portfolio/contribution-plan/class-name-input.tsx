import { TextField } from "@slotted/react/text-field";

import { useT } from "@/i18n/i18n-provider";

interface ClassNameInputProps {
  value: string;
  onChange: (name: string) => void;
}

// A blank name is marked invalid; the row writes the reason in words beside it.
export function ClassNameInput({ value, onChange }: ClassNameInputProps) {
  const t = useT();

  return (
    <TextField
      aria-label={t("contributionPlan.className")}
      autoComplete="off"
      invalid={value.trim() === ""}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
