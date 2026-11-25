import { Button } from "@slotted/react/button";

import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import { useT } from "@/i18n/i18n-provider";

interface EditorFootProps {
  onRemove: () => void;
  onDone: () => void;
}

// The end of an open criterion: remove it, or close it.
export function EditorFoot({ onRemove, onDone }: EditorFootProps) {
  const t = useT();

  return (
    <div className={styles.editFoot}>
      <Button size="sm" variant="ghost" tone="secondary" onClick={onRemove}>
        {t("contributionPlan.panel.remove")}
      </Button>

      <span className={styles.grow} />

      <Button size="sm" variant="outline" tone="secondary" onClick={onDone}>
        {t("contributionPlan.panel.done")}
      </Button>
    </div>
  );
}
