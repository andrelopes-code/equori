import { Button } from "@slotted/react/button";
import { useId } from "react";

import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface ChangeAddProps {
  full: boolean;
  onAdd: () => void;
}

// PX8: the action that adds a change, fixed below the list; at the limit it is disabled and the
// reason is written beside it.
export function ChangeAdd({ full, onAdd }: ChangeAddProps) {
  const t = useT();
  const reason = useId();

  return (
    <div className={styles.stepAdd}>
      <Button
        variant="outline"
        tone="secondary"
        disabled={full}
        aria-describedby={full ? reason : undefined}
        onClick={onAdd}
      >
        {t("portfolio.projection.contributions.add")}
      </Button>

      {full && (
        <p id={reason} className={styles.stepReason}>
          {t("portfolio.projection.contributions.add.full")}
        </p>
      )}
    </div>
  );
}
