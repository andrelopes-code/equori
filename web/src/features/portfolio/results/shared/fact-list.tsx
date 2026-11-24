import type { ReactNode } from "react";

import styles from "@/features/portfolio/results/shared/shared.module.css";

interface FactListProps {
  children: ReactNode;
}

export function FactList({ children }: FactListProps) {
  return <dl className={styles.factList}>{children}</dl>;
}
