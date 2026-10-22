import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";

import styles from "@/features/categories/appearance-picker.module.css";
import {
  CategoryIcon,
  categoryIconNames,
} from "@/features/categories/category-icon";
import type { CategoryIconName } from "@/features/categories/category-paths";
import { useT } from "@/i18n/i18n-provider";
import { ColorSwatches } from "@/ui/color-swatches";

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
    <Stack gap={5}>
      <Field>
        <FieldLabel>{t("appearance.color")}</FieldLabel>
        <ColorSwatches
          name="color"
          label={t("appearance.color")}
          value={color}
          onChange={(next) => {
            onChange({ color: next, icon });
          }}
        />
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
