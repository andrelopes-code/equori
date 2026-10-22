import styles from "@/features/categories/category-avatar.module.css";
import { CategoryIcon } from "@/features/categories/category-icon";
import type { CategoryIconName } from "@/features/categories/category-paths";

export type CategoryAvatarVariant = "solid" | "duotone" | "dot" | "budget";

// The ring's radius on its 40-unit box; its length sets the dash of the progress arc.
const ringRadius = 19;
const ringLength = 2 * Math.PI * ringRadius;

// Families read: avatar, icon, progress. An avatar draws a person's face or initials and a
// progress bar is a line, while a category is told apart by the colour and the icon its owner
// chose (A83), and its budget wraps the icon as a ring; the element is the app's own. It
// repeats the category's name beside it and stays out of the accessibility tree: a budget's
// percentage is said in text by the row that holds it.
export function CategoryAvatar({
  name,
  variant,
  color,
  icon,
  size = "md",
  progress,
}: {
  name: string;
  variant: CategoryAvatarVariant;
  color?: number | undefined;
  icon?: CategoryIconName | undefined;
  size?: "sm" | "md" | "lg";
  // Spent over budgeted, in percent; without it a budget avatar draws its track alone.
  progress?: number | undefined;
}) {
  const filled = Math.min(Math.max(progress ?? 0, 0), 100);
  return (
    <span
      className={styles.avatar}
      data-variant={variant}
      data-size={size}
      data-color={color}
      aria-hidden="true"
    >
      {variant === "budget" && (
        <svg className={styles.ring} viewBox="0 0 40 40" focusable="false">
          <circle className={styles.track} cx="20" cy="20" r={ringRadius} />
          {filled > 0 && (
            <circle
              className={styles.arc}
              cx="20"
              cy="20"
              r={ringRadius}
              strokeDasharray={`${String((ringLength * filled) / 100)} ${String(ringLength)}`}
            />
          )}
        </svg>
      )}
      {icon === undefined ? (
        Array.from(name.trim())[0]?.toLocaleUpperCase()
      ) : (
        <span className={styles.glyph}>
          <CategoryIcon
            name={icon}
            strokeWidth={1.75}
            bodyClassName={variant === "duotone" ? styles.body : undefined}
          />
        </span>
      )}
      {variant === "dot" && color !== undefined && (
        <span className={styles.dot} />
      )}
    </span>
  );
}
