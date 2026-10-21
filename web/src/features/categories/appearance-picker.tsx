import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";

import styles from "@/features/categories/appearance-picker.module.css";
import {
  CategoryIcon,
  categoryIconNames,
} from "@/features/categories/category-icon";
import { CategoryMark } from "@/features/categories/category-mark";
import type { CategoryIconName } from "@/features/categories/category-paths";
import { useT } from "@/i18n/i18n-provider";

const colors = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// Families read: radio-group, toggle-group, color-picker. None draws a choice as a swatch of a
// data slot or as a glyph tile, so the two groups are the app's own over native radios: the
// platform gives them their name, arrow keys and form value.
export function AppearancePicker({
  name,
  color,
  icon,
  onChange,
}: {
  name: string;
  color: number | null;
  icon: CategoryIconName | null;
  onChange: (next: {
    color: number | null;
    icon: CategoryIconName | null;
  }) => void;
}) {
  const t = useT();
  return (
    <Stack gap={4}>
      <div className={styles.preview}>
        <CategoryMark
          name={name || "?"}
          color={color ?? undefined}
          icon={icon ?? undefined}
          size="lg"
        />
      </div>
      <Field>
        <FieldLabel>{t("appearance.color")}</FieldLabel>
        <div
          role="radiogroup"
          aria-label={t("appearance.color")}
          className={styles.swatches}
        >
          <label className={styles.option} title={t("appearance.noColor")}>
            <input
              type="radio"
              name="color"
              className={styles.radio}
              checked={color === null}
              onChange={() => {
                onChange({ color: null, icon });
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
                name="color"
                className={styles.radio}
                checked={color === slot}
                onChange={() => {
                  onChange({ color: slot, icon });
                }}
                aria-label={t("appearance.colorN", { n: slot })}
              />
              <span className={styles.swatch} data-color={slot} />
            </label>
          ))}
        </div>
      </Field>
      <Field>
        <FieldLabel>{t("appearance.icon")}</FieldLabel>
        <div
          role="radiogroup"
          aria-label={t("appearance.icon")}
          className={styles.icons}
          data-color={color ?? undefined}
        >
          <label className={styles.option} title={t("appearance.noIcon")}>
            <input
              type="radio"
              name="icon"
              className={styles.radio}
              checked={icon === null}
              onChange={() => {
                onChange({ color, icon: null });
              }}
              aria-label={t("appearance.noIcon")}
            />
            <span className={styles.tile}>
              {Array.from(name.trim())[0]?.toLocaleUpperCase() ?? ""}
            </span>
          </label>
          {categoryIconNames.map((glyph) => (
            <label key={glyph} className={styles.option} title={glyph}>
              <input
                type="radio"
                name="icon"
                className={styles.radio}
                checked={icon === glyph}
                onChange={() => {
                  onChange({ color, icon: glyph });
                }}
                aria-label={glyph}
              />
              <span className={styles.tile}>
                <span className={styles.glyph}>
                  <CategoryIcon name={glyph} />
                </span>
              </span>
            </label>
          ))}
        </div>
      </Field>
    </Stack>
  );
}
