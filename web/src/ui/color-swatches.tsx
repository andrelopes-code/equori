import styles from "@/ui/color-swatches.module.css";
import { useT } from "@/i18n/i18n-provider";

const colors = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// Families read: radio-group, toggle-group, color-picker. None draws a choice as a swatch of a
// data slot, so the group is the app's own over native radios: the platform gives them their
// name, arrow keys and form value.
export function ColorSwatches({
  name,
  value,
  onChange,
  label,
}: {
  name: string;
  value: number | null;
  onChange: (color: number | null) => void;
  label: string;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={label} className={styles.swatches}>
      <label className={styles.option} title={t("appearance.noColor")}>
        <input
          type="radio"
          name={name}
          className={styles.radio}
          checked={value === null}
          onChange={() => {
            onChange(null);
          }}
          aria-label={t("appearance.noColor")}
        />
        <span className={styles.swatch} data-color="none" />
      </label>
      {colors.map((slot) => (
        <label
          key={slot}
          className={styles.option}
          title={t("appearance.colorN", { n: slot })}
        >
          <input
            type="radio"
            name={name}
            className={styles.radio}
            checked={value === slot}
            onChange={() => {
              onChange(slot);
            }}
            aria-label={t("appearance.colorN", { n: slot })}
          />
          <span className={styles.swatch} data-color={slot} />
        </label>
      ))}
    </div>
  );
}
