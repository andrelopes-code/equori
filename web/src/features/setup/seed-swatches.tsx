import styles from "@/features/setup/seed-swatches.module.css";
import { useT } from "@/i18n/i18n-provider";
import { accentSeeds, accents, useAccent } from "@/theme/accent";

// Families read: radio-group, toggle-group, color-picker. None draws an exclusive choice among a
// fixed set of colours as swatches; the color-picker takes any colour, which would let a reader pick
// a seed the theme was not checked against. The group is the app's own over native radios: the
// platform gives them their name, arrow keys and form value.
export function AccentSwatches({ label }: { label: string }) {
  const t = useT();
  const [accent, setAccent] = useAccent();
  return (
    <div role="radiogroup" aria-label={label} className={styles.swatches}>
      {accents.map((choice) => (
        <label
          key={choice}
          className={styles.option}
          title={t(`accent.${choice}`)}
        >
          <input
            type="radio"
            name="accent"
            className={styles.radio}
            checked={accent === choice}
            onChange={() => {
              setAccent(choice);
            }}
            aria-label={t(`accent.${choice}`)}
          />
          {/* The swatch paints the seed itself: the colour is the choice, not a token. */}
          <span
            className={styles.swatch}
            style={{ backgroundColor: accentSeeds[choice] }}
          />
        </label>
      ))}
    </div>
  );
}
