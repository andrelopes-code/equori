import { CategoryIcon } from "@/features/categories/category-icon";
import styles from "@/features/categories/category-mark.module.css";
import type { CategoryIconName } from "@/features/categories/category-paths";

// Families read: avatar, icon. An avatar draws a person's face or initials; a category is
// told apart by the colour and the icon its owner chose (A83), so the mark is the app's own.
// It repeats the category's name beside it and stays out of the accessibility tree.
export function CategoryMark({
  name,
  color,
  icon,
  size = "sm",
}: {
  name: string;
  color?: number | undefined;
  icon?: CategoryIconName | undefined;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={styles.mark}
      data-size={size}
      data-color={color}
      aria-hidden="true"
    >
      {icon === undefined ? (
        Array.from(name.trim())[0]?.toLocaleUpperCase()
      ) : (
        <span className={styles.glyph}>
          <CategoryIcon name={icon} />
        </span>
      )}
    </span>
  );
}
