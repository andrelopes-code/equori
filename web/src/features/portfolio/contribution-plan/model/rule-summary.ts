import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { TFunction } from "@/i18n/i18n-provider";

export interface RuleWords {
  t: TFunction;
  typeLabel: (type: string) => string;
  subtypeLabel: (subtype: string) => string;
  kindLabel: (kind: string) => string;
  // The guarantee of the book's jurisdiction; absent when it has none.
  guaranteeName?: string;
}

// The conditions of a rule in the order of GR2, joined by " · ".
export function ruleSummary(rule: Rule, words: RuleWords): string {
  const { t } = words;
  const parts = [
    rule.instrument_type === undefined
      ? undefined
      : words.typeLabel(rule.instrument_type),
    rule.subtypes === undefined
      ? undefined
      : rule.subtypes.map(words.subtypeLabel).join(", "),
    rule.quote_currency === undefined
      ? undefined
      : t("contributionPlan.rule.currency", { code: rule.quote_currency }),
    rule.return_kind === undefined
      ? undefined
      : words.kindLabel(rule.return_kind),
    yearsText(rule, t),
    liquidityText(rule, t),
    guaranteeText(rule, words),
  ];

  return parts.filter((part) => part !== undefined).join(" · ");
}

function yearsText(rule: Rule, t: TFunction): string | undefined {
  const from = rule.matures_from_year;
  const to = rule.matures_to_year;

  if (from !== undefined && to !== undefined)
    return t("contributionPlan.rule.years.between", { from, to });
  if (from !== undefined)
    return t("contributionPlan.rule.years.from", { from });
  if (to !== undefined) return t("contributionPlan.rule.years.to", { to });

  return undefined;
}

function liquidityText(rule: Rule, t: TFunction): string | undefined {
  if (rule.daily_liquidity === undefined) return undefined;

  return t(
    rule.daily_liquidity
      ? "contributionPlan.rule.liquidity.yes"
      : "contributionPlan.rule.liquidity.no",
  );
}

function guaranteeText(rule: Rule, words: RuleWords): string | undefined {
  if (rule.guarantee === undefined) return undefined;
  if (words.guaranteeName === undefined)
    return words.t("contributionPlan.rule.guarantee.unavailable");
  if (rule.guarantee === "covered")
    return words.t("contributionPlan.rule.guarantee.covered", {
      name: words.guaranteeName,
    });

  return words.t(`contributionPlan.rule.guarantee.${rule.guarantee}`);
}
