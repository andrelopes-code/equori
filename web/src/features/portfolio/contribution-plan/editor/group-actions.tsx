import { Button } from "@slotted/react/button";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import { useT } from "@/i18n/i18n-provider";

interface GroupActionsProps {
  count: number;
  open: boolean;
  // The id of the panel the button expands.
  controls: string;
  onToggle: () => void;
  onRemove: () => void;
}

// The end of a group row: the button that expands its assets and the remove action.
export function GroupActions({
  count,
  open,
  controls,
  onToggle,
  onRemove,
}: GroupActionsProps) {
  const t = useT();

  return (
    <div className={styles.actions}>
      <Button
        size="sm"
        variant="ghost"
        tone="accent"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
      >
        {t("contributionPlan.assetsButton", { count })}
      </Button>

      <RemoveButton
        label={t("contributionPlan.removeGroup")}
        onRemove={onRemove}
      />
    </div>
  );
}
