import type { ReactNode } from "react";

import styles from "@/features/assistant/view/answer-view.module.css";

export interface ToggleOption<V extends string> {
  value: V;
  // The visible content: a word or an icon.
  content: ReactNode;
  // The accessible name when content is an icon.
  title: string;
}

interface SegmentedToggleProps<V extends string> {
  label: string;
  options: readonly ToggleOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

// Two or three exclusive choices drawn as one pill; the chosen one is raised.
export function SegmentedToggle<V extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedToggleProps<V>) {
  return (
    <span className={styles.toggle} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.title}
          title={o.title}
          className={styles.toggleOption}
          onClick={() => {
            onChange(o.value);
          }}
        >
          {o.content}
        </button>
      ))}
    </span>
  );
}
