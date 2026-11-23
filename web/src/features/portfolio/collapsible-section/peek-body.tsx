import { Button } from "@slotted/react/button";
import {
  Collapsible,
  CollapsibleMore,
  CollapsiblePanel,
} from "@slotted/react/collapsible";
import type { ReactNode } from "react";

import styles from "@/features/portfolio/collapsible-section/peek-body.module.css";
import { useT } from "@/i18n/i18n-provider";

interface PeekBodyProps {
  id: string;
  collapsed: boolean;
  onExpand: () => void;
  children: ReactNode;
}

// The body of a section that minimizes to the start of its content, under a fade. The closed
// height holds the verdict and the first lines of the two charts; the closed content is inert, so
// focus and a reader skip it.
export function PeekBody({ id, collapsed, onExpand, children }: PeekBodyProps) {
  const t = useT();

  return (
    <Collapsible
      className={styles.body}
      open={!collapsed}
      peek="9rem"
      onOpenChange={(open) => {
        if (open) onExpand();
      }}
    >
      <CollapsiblePanel id={id}>{children}</CollapsiblePanel>

      <CollapsibleMore
        render={(props) => (
          <Button
            {...props}
            className={styles.more}
            size="sm"
            variant="outline"
            tone="secondary"
          >
            {t("fixedIncome.panel.more")}
          </Button>
        )}
      />
    </Collapsible>
  );
}
