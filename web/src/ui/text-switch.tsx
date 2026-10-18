import { useRef } from "react";
import type { KeyboardEvent } from "react";

import styles from "@/ui/text-switch.module.css";

// Families read: segmented-control, tabs, radio-group. Each boxes its options; the ledger
// switches between a few words underlined in place, as the prototype's Tudo / Saídas /
// Entradas (complete frontend F1). A radio group: one tab stop, arrows move the choice.
export function TextSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option === undefined) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-own="text-switch"
      className={styles.switch}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={styles.option}
          onClick={() => {
            onChange(option.value);
          }}
          onKeyDown={(event) => {
            move(event, index);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
