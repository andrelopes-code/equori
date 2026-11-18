import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Switch } from "@slotted/react/switch";
import { Text } from "@slotted/react/typography";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { useT } from "@/i18n/i18n-provider";

interface GroupAssetsFooterProps {
  // A group without assets has no split to switch: the line replaces the switch.
  empty: boolean;
  split: boolean;
  // Whether the ideal of each asset is derived from the investor's questions.
  byQuestions: boolean;
  onSplit: (on: boolean) => void;
  onByQuestions: (on: boolean) => void;
  onAdd: () => void;
}

// The end of the assets panel: the way to add an asset, the split of the group's target and,
// while it is split, the choice between typed targets and targets derived by questions.
export function GroupAssetsFooter({
  empty,
  split,
  byQuestions,
  onSplit,
  onByQuestions,
  onAdd,
}: GroupAssetsFooterProps) {
  const t = useT();

  return (
    <>
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

      {split && !empty && (
        <div className={styles.mode}>
          <Text size="sm" tone="muted">
            {t("contributionPlan.questions.mode")}
          </Text>

          <SegmentedControl
            size="sm"
            aria-label={t("contributionPlan.questions.mode")}
            value={byQuestions ? "questions" : "typed"}
            onValueChange={(value) => {
              onByQuestions(value === "questions");
            }}
          >
            <Segment value="typed">
              {t("contributionPlan.questions.typed")}
            </Segment>
            <Segment value="questions">
              {t("contributionPlan.questions.byQuestions")}
            </Segment>
          </SegmentedControl>
        </div>
      )}
    </>
  );
}
