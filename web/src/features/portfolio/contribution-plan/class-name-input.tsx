import { TextField } from "@slotted/react/text-field";

import styles from "@/features/portfolio/contribution-plan/class-table.module.css";
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
      className={styles.nameInput}
      size="sm"
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
