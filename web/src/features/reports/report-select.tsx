import type { ReactNode } from "react";

import styles from "@/features/reports/report-select.module.css";

// The select of a report's control row, with a measure that lets a switch stand beside it.
export function ReportSelect({ children }: { children: ReactNode }) {
  return <div className={styles.select}>{children}</div>;
}
