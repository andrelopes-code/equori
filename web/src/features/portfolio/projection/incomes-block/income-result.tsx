import { CompareTable } from "@/features/portfolio/projection/incomes-block/compare-table";
import styles from "@/features/portfolio/projection/incomes-block/incomes-block.module.css";
import { StepsTable } from "@/features/portfolio/projection/incomes-block/steps-table";
import type { JourneyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import { ageAt } from "@/features/portfolio/projection/model/age-at";
import { incomeEnd } from "@/features/portfolio/projection/model/income-end";
import { incomeSteps } from "@/features/portfolio/projection/model/income-steps";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { useToday } from "@/i18n/today";

interface IncomeResultProps {
  draft: ProjectionDraft;
  figures: JourneyFigures;
  birthDate: string;
  scale: number;
}

// PX21: the plan with and without its other incomes, or the total income per range of ages in rate
// mode; nothing without an income.
export function IncomeResult({
  draft,
  figures,
  birthDate,
  scale,
}: IncomeResultProps) {
  const today = useToday();

  if (figures.without === null) return null;

  if (draft.withdrawal.mode === "income")
    return (
      <div className={styles.scroll}>
        <CompareTable
          plan={figures}
          without={figures.without}
          lastAge={draft.lastAge}
          currency={draft.currency}
          scale={scale}
        />
      </div>
    );

  const end = incomeEnd(figures.rows, (m) =>
    m < figures.withdrawalFrom ? 0 : 1,
  );
  const steps = incomeSteps({
    incomes: draft.incomes,
    from: figures.started ? ageAt(birthDate, today) : draft.withdrawalAge,
    to: draft.lastAge,
    portfolio: figures.sustained,
    endAge: end === null ? null : ageAt(birthDate, `${end}-01`),
  });

  return (
    <div className={styles.scroll}>
      <StepsTable steps={steps} currency={draft.currency} scale={scale} />
    </div>
  );
}
