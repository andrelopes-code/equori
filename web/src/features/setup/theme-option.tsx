import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import styles from "@/features/setup/theme-gallery.module.css";
import { ThemeMiniature } from "@/features/setup/theme-miniature";
import type { ThemeValues } from "@/theme/themes";

export interface ThemeOptionProps {
  name: string;
  description?: string;
  values: ThemeValues;
  checked: boolean;
  onChoose: (values: ThemeValues) => void;
}

// Families read: radio-group, card. None draws a choice as a picture of its result. The option is
// a native radio, so the platform gives it its name, arrow keys and form value.
export function ThemeOption({
  name,
  description,
  values,
  checked,
  onChoose,
}: ThemeOptionProps) {
  return (
    <label className={styles.option}>
      <input
        type="radio"
        name="theme"
        className={styles.radio}
        checked={checked}
        aria-label={name}
        onChange={() => {
          onChoose(values);
        }}
      />
      <span className={styles.frame} aria-hidden="true">
        <ThemeMiniature values={values} />
        {checked && (
          <span className={styles.mark}>
            <Icon size="sm">
              <Glyph name="check" />
            </Icon>
          </span>
        )}
      </span>
      <span className={styles.caption}>
        <Text size="sm" weight="medium">
          {name}
        </Text>
        {description !== undefined && (
          <Text size="xs" tone="muted">
            {description}
          </Text>
        )}
      </span>
    </label>
  );
}
