import { CategoryAvatar } from "@/features/categories/category-avatar";
import type { CategoryAvatarVariant } from "@/features/categories/category-avatar";
import type { CategoryIconName } from "@/features/categories/category-paths";

const avatarSize = { sm: "sm", md: "md", xl: "lg" } as const;

// The category's mark wherever a category is named, at the step of the place that holds it.
// A long list draws it duotone; a category shown alone, as the subject of its place, draws it
// solid.
export function CategoryMark({
  name,
  color,
  icon,
  size = "sm",
  variant = "duotone",
}: {
  name: string;
  color?: number | undefined;
  icon?: CategoryIconName | undefined;
  size?: "sm" | "md" | "xl";
  variant?: Extract<CategoryAvatarVariant, "solid" | "duotone">;
}) {
  return (
    <CategoryAvatar
      name={name}
      variant={variant}
      color={color}
      icon={icon}
      size={avatarSize[size]}
    />
  );
}
