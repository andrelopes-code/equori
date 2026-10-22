import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import styles from "@/features/categories/category-preview.module.css";
import { CategoryMark } from "@/features/categories/category-mark";
import type { CategoryIconName } from "@/features/categories/category-paths";

// The category as the tree will draw it, while the dialog that writes it is open. It repeats
// what the fields below hold, so it stays out of the accessibility tree.
export function CategoryPreview({
  name,
  placeholder,
  place,
  color,
  icon,
}: {
  name: string;
  placeholder: string;
  place: string;
  color: number | null;
  icon: CategoryIconName | null;
}) {
  const shown = name.trim();
  return (
    <div className={styles.preview} aria-hidden="true">
      <Inline gap={4} wrap="nowrap">
        <CategoryMark
          name={shown || placeholder}
          color={color ?? undefined}
          icon={icon ?? undefined}
          size="xl"
          variant="solid"
        />
        <Stack gap={1} className={styles.words}>
          <Text
            size="lg"
            weight="semibold"
            tone={shown === "" ? "muted" : "default"}
            truncate
          >
            {shown || placeholder}
          </Text>
          <Text size="sm" tone="muted" truncate>
            {place}
          </Text>
        </Stack>
      </Inline>
    </div>
  );
}
