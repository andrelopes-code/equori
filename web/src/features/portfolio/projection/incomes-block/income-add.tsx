import { Button } from "@slotted/react/button";
import { useId } from "react";

import styles from "@/features/portfolio/projection/incomes-block/incomes-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface IncomeAddProps {
  full: boolean;
  onAdd: () => void;
}

// PX21: the action that adds an income; at the limit it is disabled and the reason is written.
export function IncomeAdd({ full, onAdd }: IncomeAddProps) {
  const t = useT();
  const reason = useId();

  return (
    <div>
      <Button
        variant="outline"
        tone="secondary"
        disabled={full}
        aria-describedby={full ? reason : undefined}
        onClick={onAdd}
      >
        {t("portfolio.projection.incomes.add")}
      </Button>

      {full && (
        <p id={reason} className={styles.reason}>
          {t("portfolio.projection.incomes.add.full")}
        </p>
      )}
    </div>
  );
}
