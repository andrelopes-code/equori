import styles from "@/features/setup/seed-swatches.module.css";

export interface SeedChoice<T extends string> {
  value: T;
  label: string;
  color: string;
}

// Families read: radio-group, toggle-group, color-picker. None draws an exclusive choice among a
// fixed set of colours as swatches; the color-picker takes any colour and stands beside the group
// where a free choice is offered. The group is the app's own over native radios: the platform
// gives them their name, arrow keys and form value.
export function SeedSwatches<T extends string>({
  name,
  label,
  choices,
  value,
  onChange,
}: {
  name: string;
  label: string;
  choices: readonly SeedChoice<T>[];
  value: string;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.swatches}>
      {choices.map((choice) => (
        <label
          key={choice.value}
          className={styles.option}
          title={choice.label}
        >
          <input
            type="radio"
            name={name}
            className={styles.radio}
            checked={value === choice.value}
            onChange={() => {
              onChange(choice.value);
            }}
            aria-label={choice.label}
          />
          {/* The swatch paints the seed itself: the colour is the choice, not a token. */}
          <span
            className={styles.swatch}
            style={{ backgroundColor: choice.color }}
          />
        </label>
      ))}
    </div>
  );
}
