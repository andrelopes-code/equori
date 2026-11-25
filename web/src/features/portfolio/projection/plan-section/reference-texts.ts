import { indexName } from "@/features/calculators";
import type { PlanReference } from "@/features/portfolio/projection/plan-section/plan-references";
import { formatBasisPoints, numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

interface TextsInput {
  realBp: number | null;
  cautiousBp: number | null;
  favorableBp: number | null;
  curve: PlanReference | null;
  // The realized real return a year, a fraction.
  portfolio: number | null;
}

interface RowText {
  name: string;
  value: string;
}

// PX17: the name and the rate of each row of the references; a row the scale does not draw is empty.
export function referenceTexts(
  input: TextsInput,
  t: TFunction,
  locale: string,
): Record<"plan" | "curve" | "portfolio", RowText> {
  const bp = (value: number) => formatBasisPoints(value, locale);
  const real = input.realBp === null ? "" : bp(input.realBp);
  const low = input.cautiousBp ?? input.realBp;
  const high = input.favorableBp ?? input.realBp;
  const ranged = low !== high && low !== null && high !== null;

  return {
    plan: {
      name: t("portfolio.projection.plan.references.plan"),
      value: ranged
        ? t("portfolio.projection.plan.references.range", {
            from: bp(low),
            to: bp(high),
          })
        : real,
    },
    curve: {
      name:
        input.curve === null
          ? ""
          : t("portfolio.projection.plan.references.curve", {
              index: indexName(input.curve.index),
              year: String(input.curve.year),
            }),
      value:
        input.curve === null ? "" : bp(Math.round(input.curve.rate * 10000)),
    },
    portfolio: {
      name: t("portfolio.projection.plan.references.portfolio"),
      value:
        input.portfolio === null
          ? ""
          : numberFormatter(locale, {
              style: "percent",
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }).format(input.portfolio),
    },
  };
}
