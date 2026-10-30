import {
  Popover,
  PopoverAnchor,
  PopoverBody,
  PopoverContent,
  PopoverLayer,
  PopoverTrigger,
} from "@slotted/react/popover";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/categories/appearance-picker.module.css";
import { CategoryMark } from "@/features/categories/category-mark";
import type { CategoryIconName } from "@/features/categories/category-paths";
import { IconChoices } from "@/features/categories/icon-choices";
import { useT } from "@/i18n/i18n-provider";
import { ColorSwatches } from "@/ui/color-swatches";

interface AppearancePickerProps {
  // The name the mark draws its initial from while no icon is chosen.
  name: string;
  color: number | null;
  icon: CategoryIconName | null;
  onChange: (next: {
    color: number | null;
    icon: CategoryIconName | null;
  }) => void;
  // The name's text field, drawn after the mark; the panel opens under both, as wide as the row.
  children: ReactNode;
}

// Families read: popover, avatar. The category's mark is the trigger: it previews the look the
// panel chooses, so the form draws no separate preview. The panel takes the row's width, since
// the popover's own widths (at most 24rem) fit neither the colours nor the icons on one line.
export function AppearancePicker({
  name,
  color,
  icon,
  onChange,
  children,
}: AppearancePickerProps) {
  const t = useT();

  return (
    <Popover width="anchor" align="start" initialFocus="input:checked">
      <PopoverAnchor
        render={(props) => (
          <div {...props} className={styles.row}>
            <PopoverTrigger
              render={(triggerProps) => (
                <button
                  {...triggerProps}
                  type="button"
                  className={styles.trigger}
                  aria-label={t("appearance.choose")}
                >
                  <CategoryMark
                    name={name}
                    color={color ?? undefined}
                    icon={icon ?? undefined}
                    variant="solid"
                  />
                </button>
              )}
            />
            {children}
          </div>
        )}
      />
      <PopoverLayer>
        <PopoverContent aria-label={t("appearance.choose")}>
          <PopoverBody>
            <Stack gap={6}>
              <Stack gap={2}>
                <Text size="sm" weight="medium">
                  {t("appearance.color")}
                </Text>
                <ColorSwatches
                  name="color"
                  label={t("appearance.color")}
                  value={color}
                  onChange={(next) => {
                    onChange({ color: next, icon });
                  }}
                />
              </Stack>

              <Stack gap={2}>
                <Text size="sm" weight="medium">
                  {t("appearance.icon")}
                </Text>
                <IconChoices
                  name={name}
                  color={color}
                  icon={icon}
                  onChange={(next) => {
                    onChange({ color, icon: next });
                  }}
                />
              </Stack>
            </Stack>
          </PopoverBody>
        </PopoverContent>
      </PopoverLayer>
    </Popover>
  );
}
