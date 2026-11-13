import { TextField } from "@slotted/react/text-field";

import { nameRequiredId } from "@/features/portfolio/contribution-plan/editor/name-required-message";
import styles from "@/features/portfolio/contribution-plan/table/class-table.module.css";
import { useT } from "@/i18n/i18n-provider";

interface ClassNameInputProps {
  value: string;
  onChange: (name: string) => void;
}

// A blank name is marked invalid and points at the one message above the rows.
export function ClassNameInput({ value, onChange }: ClassNameInputProps) {
  const t = useT();

  return (
    <TextField
      className={styles.nameInput}
      size="sm"
      autoFocus={value.trim() === ""}
      aria-label={t("contributionPlan.className")}
      autoComplete="off"
      invalid={value.trim() === ""}
      aria-describedby={value.trim() === "" ? nameRequiredId : undefined}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
