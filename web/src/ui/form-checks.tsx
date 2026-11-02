import type { ReactNode } from "react";

import styles from "@/ui/form-checks.module.css";

interface FormChecksProps {
  children: ReactNode;
}

// F5: checkboxes in sequence with no label or description of their own stand as one block.
export function FormChecks({ children }: FormChecksProps) {
  return <div className={styles.checks}>{children}</div>;
}
