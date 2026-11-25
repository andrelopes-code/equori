import { Button } from "@slotted/react/button";

import styles from "@/features/portfolio/projection/years-block/years-block.module.css";
import { useT } from "@/i18n/i18n-provider";

interface YearsMoreProps {
  count: number;
  open: boolean;
  onToggle: () => void;
}

// PX10: opens every year in a region twelve rows tall, and closes it again.
export function YearsMore({ count, open, onToggle }: YearsMoreProps) {
  const t = useT();

  return (
    <div className={styles.tableMore}>
      <Button
        size="sm"
        variant="ghost"
        tone="secondary"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open
          ? t("portfolio.projection.years.less")
          : t("portfolio.projection.years.more", { count: String(count) })}
      </Button>
    </div>
  );
}
