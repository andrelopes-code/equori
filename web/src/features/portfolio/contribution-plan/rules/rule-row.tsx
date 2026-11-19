import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { EditDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { ruleSummary } from "@/features/portfolio/contribution-plan/model/rule-summary";
import { kindLabel } from "@/features/portfolio/contribution-plan/rules/rule-form";
import { RuleEditButton } from "@/features/portfolio/contribution-plan/rules/rule-edit-button";
import styles from "@/features/portfolio/contribution-plan/rules/rules.module.css";
import { useRuleMatch } from "@/features/portfolio/contribution-plan/rules/use-rule-match";
import type { RuleMatch } from "@/features/portfolio/contribution-plan/rules/use-rule-match";
import { subtypeLabel, typeLabel } from "@/features/instruments";
import { useScale } from "@/features/setup";
import type { TFunction } from "@/i18n/i18n-provider";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface RuleRowProps {
  index: number;
  rule: Rule;
  draft: EditDraft | undefined;
  guaranteeName: string | undefined;
  onEdit: () => void;
  onRemove: () => void;
}

// One rule in words, the securities that meet it and the two buttons, on one line.
export function RuleRow({
  index,
  rule,
  draft,
  guaranteeName,
  onEdit,
  onRemove,
}: RuleRowProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const unavailable =
    rule.guarantee !== undefined && guaranteeName === undefined;
  const match = useRuleMatch(draft, index, unavailable ? undefined : rule);
  const summary = ruleSummary(rule, {
    t,
    typeLabel: (type) => typeLabel(t, type),
    subtypeLabel: (subtype) => subtypeLabel(t, subtype),
    kindLabel: (kind) => kindLabel(t, kind),
    ...(guaranteeName === undefined ? {} : { guaranteeName }),
  });
  const count = countText(unavailable ? { count: 0 } : match, t, (money) =>
    fmt.money(money, scale?.(money.currency) ?? 0),
  );

  return (
    <div role="listitem" className={styles.rule}>
      <Text
        size="md"
        title={summary}
        tone={unavailable ? "danger" : undefined}
        className={styles.summary}
      >
        {summary}
      </Text>

      <Text size="md" title={count} className={styles.count}>
        {count}
      </Text>

      <div>
        <RuleEditButton
          label={t("contributionPlan.rule.edit")}
          onEdit={onEdit}
        />
        <RemoveButton
          label={t("contributionPlan.rule.remove")}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

function countText(
  match: { count: number; value?: Money } | RuleMatch | undefined,
  t: TFunction,
  money: (value: Money) => string,
): string {
  if (match === undefined) return "";
  if (match.count === 0 || match.value === undefined)
    return t("contributionPlan.rule.none");

  const value = money(match.value);

  return match.count === 1
    ? t("contributionPlan.rule.countOne", { value })
    : t("contributionPlan.rule.countMany", { count: match.count, value });
}
