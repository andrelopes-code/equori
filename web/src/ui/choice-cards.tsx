import type { ReactNode } from "react";

import styles from "@/ui/choice-cards.module.css";

export interface CardChoice {
  value: string;
  label: string;
  preview: ReactNode;
}

// Families read: radio-group, segmented-control, toggle-group, card. None draws an exclusive choice
// as a picture of its result, which a colour scheme or a density needs for the reader to choose by
// sight. The group is the app's own over native radios: the platform gives them their name, arrow
// keys and form value.
export function ChoiceCards({
  name,
  label,
  choices,
  value,
  onChange,
}: {
  name: string;
  label: string;
  choices: readonly CardChoice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.frame}>
      <div
        role="radiogroup"
        aria-label={label}
        className={styles.group}
        data-count={choices.length}
      >
        {choices.map((choice) => (
          <label key={choice.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              className={styles.radio}
              checked={value === choice.value}
              onChange={() => {
                onChange(choice.value);
              }}
            />
            <span className={styles.card}>
              <span className={styles.preview} aria-hidden="true">
                {choice.preview}
              </span>
              <span className={styles.caption}>
                <span className={styles.label}>{choice.label}</span>
                <span className={styles.mark} aria-hidden="true" />
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
