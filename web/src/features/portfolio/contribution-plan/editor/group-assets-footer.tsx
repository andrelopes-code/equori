import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Switch } from "@slotted/react/switch";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { useT } from "@/i18n/i18n-provider";

interface GroupAssetsFooterProps {
  // A group without assets has no split to switch: the line replaces the switch.
  empty: boolean;
  split: boolean;
  // The number of criteria that set the ideals; zero without criteria.
  criteria: number;
  onSplit: (on: boolean) => void;
  onCriteria: () => void;
  onAdd: () => void;
}

// The end of the assets panel: the split of the group's target, the way to its criteria and the
// way to add an asset. With criteria the split is theirs, so the switch leaves.
export function GroupAssetsFooter({
  empty,
  split,
  criteria,
  onSplit,
  onCriteria,
  onAdd,
}: GroupAssetsFooterProps) {
  const t = useT();

  return (
    <div className={empty ? styles.footerEmpty : styles.footer}>
      {empty && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.noAssets")}
        </Text>
      )}

      {!empty && criteria > 0 && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.criteria.byCriteria")}
        </Text>
      )}

      {!empty && criteria === 0 && (
        <Switch
          size="sm"
          checked={split}
          description={t("contributionPlan.splitHint")}
          onCheckedChange={onSplit}
        >
          {t("contributionPlan.splitLong")}
        </Switch>
      )}

      <div className={styles.footerActions}>
        {!empty && (
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={onCriteria}
          >
            {t(
              criteria > 0
                ? "contributionPlan.criteria.open"
                : "contributionPlan.criteria.use",
            )}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          tone="secondary"
          start={<Glyph name="plus" />}
          onClick={onAdd}
        >
          {t("contributionPlan.addAsset")}
        </Button>
      </div>
    </div>
  );
}
