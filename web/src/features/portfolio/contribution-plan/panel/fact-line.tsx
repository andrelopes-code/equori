import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";

interface FactLineProps {
  label: string;
  value?: string;
  action?: string;
  onAction?: () => void;
}

// A fact of the asset in one line, with the way to its detail.
export function FactLine({ label, value, action, onAction }: FactLineProps) {
  return (
    <div className={styles.fact}>
      <Text size="sm" tone="muted">
        {label}
      </Text>

      {value !== undefined && (
        <Text size="sm" weight="medium">
          {value}
        </Text>
      )}

      <span className={styles.grow} />

      {action !== undefined && (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => onAction?.()}
        >
          {action}
        </Button>
      )}
    </div>
  );
}
