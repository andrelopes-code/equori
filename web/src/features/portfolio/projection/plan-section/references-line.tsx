import { Text } from "@slotted/react/typography";

import { indexName } from "@/features/calculators";
import type { PlanReference } from "@/features/portfolio/projection/plan-section/plan-references";
import { usePlanReferences } from "@/features/portfolio/projection/plan-section/use-plan-references";
import { formatBasisPoints, formatYear } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ReferencesLineProps {
  currency: string;
}

// PX17: the stored rates beside the premises; it fills no field and draws nothing without a curve.
export function ReferencesLine({ currency }: ReferencesLineProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const { real, inflation } = usePlanReferences(currency);

  if (real === null) return null;

  const vars = (reference: PlanReference) => ({
    index: indexName(reference.index),
    rate: formatBasisPoints(Math.round(reference.rate * 10000), tag),
    year: formatYear(`${String(reference.year)}-01-01`, tag),
  });
  const parts = [t("portfolio.projection.plan.references.real", vars(real))];
  if (inflation !== null)
    parts.push(
      t("portfolio.projection.plan.references.inflation", vars(inflation)),
    );

  return (
    <Text size="sm" tone="muted">
      {t("portfolio.projection.plan.references", { list: parts.join(" · ") })}
    </Text>
  );
}
