import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/dialogs/confirm-dialog";

interface RuleModeChoiceProps {
  byRule: boolean;
  // What each mode drops when the reader leaves it: the chosen assets or the rules.
  members: number;
  rules: number;
  onChange: (byRule: boolean) => void;
}

// The choice between chosen assets and rules. A change that drops assets or rules asks first.
export function RuleModeChoice({
  byRule,
  members,
  rules,
  onChange,
}: RuleModeChoiceProps) {
  const t = useT();

  const [asked, setAsked] = useState<boolean | undefined>(undefined);

  const dropped = byRule ? rules : members;
  const dropKey = byRule ? "dropRules" : "dropMembers";
  const description =
    dropped === 1
      ? t(`contributionPlan.rule.mode.${dropKey}One`)
      : t(`contributionPlan.rule.mode.${dropKey}Many`, { count: dropped });

  function handleValue(value: string) {
    const next = value === "rule";
    if (next === byRule) return;

    if (dropped === 0) onChange(next);
    else setAsked(next);
  }

  function handleConfirm() {
    if (asked !== undefined) onChange(asked);
    setAsked(undefined);
  }

  return (
    <div className={styles.mode}>
      <Text size="sm" tone="muted">
        {t("contributionPlan.rule.mode.label")}
      </Text>

      <SegmentedControl
        size="sm"
        aria-label={t("contributionPlan.rule.mode.label")}
        value={byRule ? "rule" : "chosen"}
        onValueChange={handleValue}
      >
        <Segment value="chosen">
          {t("contributionPlan.rule.mode.chosen")}
        </Segment>
        <Segment value="rule">{t("contributionPlan.rule.mode.byRule")}</Segment>
      </SegmentedControl>

      {asked !== undefined && (
        <ConfirmDialog
          title={t("contributionPlan.rule.mode.label")}
          description={description}
          confirmLabel={t("contributionPlan.rule.mode.confirm")}
          cancelLabel={t("contributionPlan.rule.mode.keep")}
          tone="warning"
          onConfirm={handleConfirm}
          onCancel={() => {
            setAsked(undefined);
          }}
        />
      )}
    </div>
  );
}
