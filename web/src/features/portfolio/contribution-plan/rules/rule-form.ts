import type { TFunction } from "@/i18n/i18n-provider";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";

type Kind = NonNullable<Rule["return_kind"]>;
type Guarantee = NonNullable<Rule["guarantee"]>;

export interface RuleForm {
  // The empty string is "Qualquer" for the type, the kind, the guarantee and the currency.
  type: string;
  subtypes: string[];
  kind: string;
  from: number | null;
  to: number | null;
  liquidity: "any" | "yes" | "no";
  guarantee: string;
  currency: string;
}

export const kinds: Kind[] = ["rate", "inflation", "fixed"];
export const guarantees: Guarantee[] = ["covered", "sovereign", "uncovered"];

const kindKeys = {
  rate: "fixedIncome.kind.rate",
  inflation: "fixedIncome.kind.inflation",
  fixed: "fixedIncome.kind.fixed",
} as const;

export const emptyForm: RuleForm = {
  type: "",
  subtypes: [],
  kind: "",
  from: null,
  to: null,
  liquidity: "any",
  guarantee: "",
  currency: "",
};

const minYear = 1900;
const maxYear = 2200;

export function formOfRule(rule: Rule): RuleForm {
  return {
    type: rule.instrument_type ?? "",
    subtypes: rule.subtypes ?? [],
    kind: rule.return_kind ?? "",
    from: rule.matures_from_year ?? null,
    to: rule.matures_to_year ?? null,
    liquidity:
      rule.daily_liquidity === undefined
        ? "any"
        : rule.daily_liquidity
          ? "yes"
          : "no",
    guarantee: rule.guarantee ?? "",
    currency: rule.quote_currency ?? "",
  };
}

// Only the conditions the reader set: the return kind needs a type of "any" or fixed income, and
// the subtypes need a type.
export function ruleOfForm(form: RuleForm): Rule {
  const kind = takesKind(form.type)
    ? kinds.find((k) => k === form.kind)
    : undefined;
  const guarantee = guarantees.find((g) => g === form.guarantee);

  return {
    ...(form.type === "" ? {} : { instrument_type: form.type }),
    ...(form.type !== "" && form.subtypes.length > 0
      ? { subtypes: form.subtypes }
      : {}),
    ...(form.currency === "" ? {} : { quote_currency: form.currency }),
    ...(kind === undefined ? {} : { return_kind: kind }),
    ...(form.from === null ? {} : { matures_from_year: form.from }),
    ...(form.to === null ? {} : { matures_to_year: form.to }),
    ...(form.liquidity === "any"
      ? {}
      : { daily_liquidity: form.liquidity === "yes" }),
    ...(guarantee === undefined ? {} : { guarantee }),
  };
}

export function takesKind(type: string): boolean {
  return type === "" || type === "fixed_income";
}

export function yearProblem(years: {
  from: number | null;
  to: number | null;
}): "yearRange" | "yearOrder" | undefined {
  if (!inRange(years.from) || !inRange(years.to)) return "yearRange";
  if (years.from !== null && years.to !== null && years.to < years.from)
    return "yearOrder";

  return undefined;
}

function inRange(year: number | null): boolean {
  return (
    year === null ||
    (Number.isInteger(year) && year >= minYear && year <= maxYear)
  );
}

export function kindLabel(t: TFunction, kind: string): string {
  const known = kinds.find((k) => k === kind);

  return known === undefined ? kind : t(kindKeys[known]);
}
