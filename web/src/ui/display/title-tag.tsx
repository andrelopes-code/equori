import { Tag } from "@slotted/react/tag";
import type { ComponentProps } from "react";

import { cx } from "@/ui/cx";
import styles from "@/ui/display/title-tag.module.css";

type TitleTagProps = Omit<ComponentProps<typeof Tag>, "size">;

// A tag beside a title or a text: it is drawn inside the line and adds nothing to its height (O22).
export function TitleTag({ className, ...props }: TitleTagProps) {
  return <Tag {...props} size="sm" className={cx(styles.tag, className)} />;
}
