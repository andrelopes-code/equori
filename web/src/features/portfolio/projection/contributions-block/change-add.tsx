import { Button } from "@slotted/react/button";
import { useId } from "react";

import styles from "@/features/portfolio/projection/contributions-block/contributions-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface ChangeAddProps {
  full: boolean;
  // PX19: no contribution is left to plan.
  started: boolean;
  onAdd: () => void;
}

// PX8: the action that adds a change, fixed below the list; at the limit it is disabled and the
// reason is written beside it.
export function ChangeAdd({ full, started, onAdd }: ChangeAddProps) {
  const t = useT();
  const reason = useId();

  const blocked = full || started;

  return (
    <div className={styles.stepAdd}>
      <Button
        variant="outline"
        tone="secondary"
        disabled={blocked}
        aria-describedby={blocked ? reason : undefined}
        onClick={onAdd}
      >
        {t("portfolio.projection.contributions.add")}
      </Button>

      {blocked && (
        <p id={reason} className={styles.stepReason}>
          {started
            ? t("portfolio.projection.contributions.add.started")
            : t("portfolio.projection.contributions.add.full")}
        </p>
      )}
    </div>
  );
}
