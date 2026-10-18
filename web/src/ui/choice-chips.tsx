import { useField } from "@slotted/react/field";

import styles from "@/ui/choice-chips.module.css";

// Families read: toggle-group, chip, tag, select. The toggle group draws a boxed segmented
// row and a select hides the choices; a ledger offers a short list as words to tap, the
// chosen one in ink (complete frontend F1 and F2). Inside a Field the group takes the
// field's label.
export function ChoiceChips({
  label,
  choices,
  value,
  onChange,
  size = "md",
}: {
  label?: string;
  choices: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string) => void;
  size?: "md" | "lg";
}) {
  const field = useField();
  return (
    <div
      role="group"
      {...(field === undefined
        ? { "aria-label": label }
        : { "aria-labelledby": field.ids.label, id: field.ids.control })}
      data-own="choice-chips"
      data-size={size}
      className={styles.chips}
    >
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-pressed={choice.id === value}
          className={styles.chip}
          onClick={() => {
            onChange(choice.id);
          }}
        >
          {choice.name}
        </button>
      ))}
    </div>
  );
}
