import { Text } from "@slotted/react/typography";
import type { ReactNode } from "react";

import styles from "@/features/help/styles/help.module.css";

interface HelpLinkRowsProps {
  label: string;
  // HelpRow elements.
  children: ReactNode;
}

// A group of rows that leads away from the page, opened by its rule.
export function HelpLinkRows({ label, children }: HelpLinkRowsProps) {
  return (
    <nav className={styles.linked} aria-label={label}>
      <div className={styles.groupHead}>
        <Text
          size="sm"
          tone="muted"
          weight="medium"
          render={(props) => <h3 {...props} />}
        >
          {label}
        </Text>
      </div>

      <ul className={styles.rows} role="list">
        {children}
      </ul>
    </nav>
  );
}
