import type { ReactNode } from "react";

import styles from "@/ui/form-layout.module.css";

interface FormRowProps {
  children: ReactNode;
}

// F2: two fields that are parts of one answer share a row; below 600 px they stack.
export function FormRow({ children }: FormRowProps) {
  return <div className={styles.row}>{children}</div>;
}
