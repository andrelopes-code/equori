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
  // The criteria of the group set the ideals of its assets.
  derived: boolean;
  onSplit: (on: boolean) => void;
  onAdd: () => void;
}

// The end of the assets panel: the split of the group's target and the way to add an asset. Where the
// criteria set the ideals the split is theirs, so the switch leaves.
export function GroupAssetsFooter({
  empty,
  split,
  derived,
  onSplit,
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

      {!empty && derived && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.criteria.byCriteria")}
        </Text>
      )}

      {!empty && !derived && (
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
