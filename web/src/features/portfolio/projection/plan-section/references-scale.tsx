import type { PlanFields } from "@/features/portfolio/projection/model/plan-fields";
import { parseBasisPoints } from "@/features/portfolio/projection/model/parse-percent";
import styles from "@/features/portfolio/projection/plan-section/plan.module.css";
import type { PlanReference } from "@/features/portfolio/projection/plan-section/plan-references";
import { referenceScale } from "@/features/portfolio/projection/plan-section/reference-scale";
import { referenceTexts } from "@/features/portfolio/projection/plan-section/reference-texts";
import { ScaleAxis } from "@/features/portfolio/projection/plan-section/scale-axis";
import { ScaleRow } from "@/features/portfolio/projection/plan-section/scale-row";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface ReferencesScaleProps {
  fields: PlanFields;
  // The longest point of the real curve in the plan's currency; null while none is stored.
  curve: PlanReference | null;
  // The realized real return of the portfolio a year, a fraction; null under 12 months of history.
  annualReal: number | null;
}

// build-own-element: PX17, PX22: the plan's range of real returns beside the stored rate and the
// realized one, one bar per row on one axis; no family draws ranges and bars on a shared scale.
export function ReferencesScale({
  fields,
  curve,
  annualReal,
}: ReferencesScaleProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const input = {
    realBp: parseBasisPoints(fields.realReturn),
    cautiousBp: parseBasisPoints(fields.cautious),
    favorableBp: parseBasisPoints(fields.favorable),
    curve: curve?.rate ?? null,
    portfolio: annualReal,
  };
  const scale = referenceScale(input);
  const texts = referenceTexts(
    { ...input, curve, portfolio: annualReal },
    t,
    locale,
  );

  if (scale === null) return null;

  const label = t("portfolio.projection.plan.references.label", {
    list: scale.rows
      .map((row) => `${texts[row.kind].name} ${texts[row.kind].value}`)
      .join("; "),
  });

  return (
    <div className={cx(styles.planGroup, styles.planScale)}>
      <p className={styles.planGroupLegend}>
        {t("portfolio.projection.plan.references")}
      </p>

      <p className={styles.planGroupDescription}>
        {t("portfolio.projection.plan.referencesDescription")}
      </p>

      <div className={styles.planGroupRows} role="img" aria-label={label}>
        {scale.rows.map((row) => (
          <ScaleRow key={row.kind} row={row} {...texts[row.kind]} />
        ))}

        <ScaleAxis ticks={scale.ticks} />
      </div>
    </div>
  );
}
