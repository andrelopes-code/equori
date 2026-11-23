import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { CategoryIcon, isCategoryIcon } from "@/features/categories";

interface ChangeValueProps {
  field: string;
  text: string;
}

// One value of a change: the icon of an account or category as its glyph, any other as its text.
export function ChangeValue({ field, text }: ChangeValueProps) {
  if (field !== "icon" || !isCategoryIcon(text)) return text;

  return (
    <span className={styles.icon14}>
      <CategoryIcon name={text} />
      <VisuallyHidden>{text}</VisuallyHidden>
    </span>
  );
}
