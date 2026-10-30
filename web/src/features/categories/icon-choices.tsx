import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useId } from "react";

import styles from "@/features/categories/icon-choices.module.css";
import { CategoryIcon } from "@/features/categories/category-icon";
import type { CategoryIconName } from "@/features/categories/category-paths";
import { iconGroups } from "@/features/categories/icon-groups";
import { useT } from "@/i18n/i18n-provider";

interface IconChoicesProps {
  name: string;
  color: number | null;
  icon: CategoryIconName | null;
  onChange: (icon: CategoryIconName | null) => void;
}

// Families read: radio-group, toggle-group. None draws a choice as a glyph tile, so the group is
// the app's own over native radios: the platform gives them their name, arrow keys and form value.
export function IconChoices({ name, color, icon, onChange }: IconChoicesProps) {
  const t = useT();
  const id = useId();

  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";

  return (
    <div
      role="radiogroup"
      aria-label={t("appearance.icon")}
      className={styles.icons}
      data-color={color ?? undefined}
    >
      <Stack gap={4}>
        <div className={styles.grid}>
          <label className={styles.option} title={t("appearance.noIcon")}>
            <input
              type="radio"
              name="icon"
              className={styles.radio}
              checked={icon === null}
              onChange={() => {
                onChange(null);
              }}
              aria-label={t("appearance.noIcon")}
            />
            <span className={styles.tile}>{initial}</span>
          </label>
        </div>

        {iconGroups.map((group) => (
          <div
            key={group.key}
            role="group"
            aria-labelledby={`${id}-${group.key}`}
          >
            <Stack gap={2}>
              <Text id={`${id}-${group.key}`} size="xs" tone="muted">
                {t(`appearance.group.${group.key}`)}
              </Text>
              <div className={styles.grid}>
                {group.icons.map((glyph) => (
                  <label key={glyph} className={styles.option} title={glyph}>
                    <input
                      type="radio"
                      name="icon"
                      className={styles.radio}
                      checked={icon === glyph}
                      onChange={() => {
                        onChange(glyph);
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
            </Stack>
          </div>
        ))}
      </Stack>
    </div>
  );
}
