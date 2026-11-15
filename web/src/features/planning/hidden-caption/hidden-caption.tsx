import { TableCaption } from "@slotted/react/table";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/planning/hidden-caption/hidden-caption.module.css";

interface HiddenCaptionProps {
  text: string;
}

// The name of a table that sits under a heading already saying it: read, not shown (spec P4).
export function HiddenCaption({ text }: HiddenCaptionProps) {
  return (
    <TableCaption className={styles.caption}>
      <VisuallyHidden>{text}</VisuallyHidden>
    </TableCaption>
  );
}
