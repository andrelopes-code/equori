import { instrumentTypes, typeLabel } from "@/features/instruments";
import {
  kindLabel,
  kinds,
} from "@/features/portfolio/contribution-plan/rules/rule-form";
import type { TFunction } from "@/i18n/i18n-provider";

export interface Choice {
  value: string;
  label: string;
}

// The security types of the catalog after "Qualquer"; a currency is no security (GR2).
export function typeChoices(t: TFunction): Choice[] {
  const types = instrumentTypes.filter((type) => type !== "currency");

  return [
    anyChoice(t),
    ...types.map((type) => ({ value: type, label: typeLabel(t, type) })),
  ];
}

export function kindChoices(t: TFunction): Choice[] {
  return [
    anyChoice(t),
    ...kinds.map((kind) => ({ value: kind, label: kindLabel(t, kind) })),
  ];
}

export function liquidityChoices(t: TFunction): Choice[] {
  return [
    { value: "any", label: t("contributionPlan.rule.dialog.any") },
    { value: "yes", label: t("contributionPlan.rule.dialog.yes") },
    { value: "no", label: t("contributionPlan.rule.dialog.no") },
  ];
}

// The words of a guarantee condition; name is the guarantee of the book's region (GR8).
export function guaranteeChoices(t: TFunction, name: string): Choice[] {
  return [
    anyChoice(t),
    {
      value: "covered",
      label: t("contributionPlan.rule.dialog.covered", { name }),
    },
    { value: "sovereign", label: t("contributionPlan.rule.dialog.sovereign") },
    { value: "uncovered", label: t("contributionPlan.rule.dialog.uncovered") },
  ];
}

// The currencies of the catalog after "Qualquer", by their codes.
export function currencyChoices(
  t: TFunction,
  items: readonly { code: string; type: string }[],
): Choice[] {
  const codes = items.filter((i) => i.type === "currency").map((i) => i.code);

  return [anyChoice(t), ...codes.map((code) => ({ value: code, label: code }))];
}

function anyChoice(t: TFunction): Choice {
  return { value: "", label: t("contributionPlan.rule.dialog.any") };
}
