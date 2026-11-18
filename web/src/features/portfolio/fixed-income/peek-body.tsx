import { Button } from "@slotted/react/button";
import type { ReactNode } from "react";

import styles from "@/features/portfolio/fixed-income/peek-body.module.css";
import { useT } from "@/i18n/i18n-provider";

interface PeekBodyProps {
  id: string;
  collapsed: boolean;
  onExpand: () => void;
  children: ReactNode;
}

// Own element: Collapsible hides its whole panel (families read: collapsible, section,
// scroll-area); this one keeps the start of the content in view under a fade.
// Workaround for Slotted issue #143: the family has no closed state that keeps content in view.
// The closed content is inert, so focus and a reader skip it.
export function PeekBody({ id, collapsed, onExpand, children }: PeekBodyProps) {
  const t = useT();

  return (
    <div className={styles.root}>
      <div
        id={id}
        className={styles.content}
        data-peek={collapsed ? "closed" : "open"}
        inert={collapsed}
      >
        {children}
      </div>

      {collapsed && (
        <div className={styles.more}>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onExpand}
          >
            {t("fixedIncome.panel.more")}
          </Button>
        </div>
      )}
    </div>
  );
}
