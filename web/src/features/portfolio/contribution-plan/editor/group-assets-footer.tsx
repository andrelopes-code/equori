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
  onSplit: (on: boolean) => void;
  onAdd: () => void;
}

// The end of the assets panel: the way to add an asset and the split of the group's target.
export function GroupAssetsFooter({
  empty,
  split,
  onSplit,
  onAdd,
}: GroupAssetsFooterProps) {
  const t = useT();

  return (
    <div className={empty ? styles.footerEmpty : styles.footer}>
      {empty ? (
        <Text size="sm" tone="muted">
          {t("contributionPlan.noAssets")}
        </Text>
      ) : (
        <Switch
          size="sm"
          checked={split}
          description={t("contributionPlan.splitHint")}
          onCheckedChange={onSplit}
        >
          {t("contributionPlan.splitLong")}
        </Switch>
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
  );
}
