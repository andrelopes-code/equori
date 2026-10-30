import type { ReactNode } from "react";

import styles from "@/ui/form-layout.module.css";

interface FormLayoutProps {
  children: ReactNode;
  // What the whole record will do: a preview, a summary in words (docs/contributing/forms.md, F8).
  aside?: ReactNode;
  // In a dialog the body is the measure: the column fills it (docs/contributing/forms.md, F15).
  fill?: boolean;
}

// F1: the fields stand in one column of at most 40rem; the aside stands beside it when both fit.
export function FormLayout({ children, aside, fill = false }: FormLayoutProps) {
  return (
    <div className={styles.frame}>
      <div
        className={[styles.layout, fill ? styles.fill : undefined]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.fields}>{children}</div>
        {aside !== undefined && <aside className={styles.aside}>{aside}</aside>}
      </div>
    </div>
  );
}
