import type { components } from "@/api/schema.gen";
import { CasesBlock } from "@/features/portfolio/projection/cases-block/cases-block";
import { ContributionsBlock } from "@/features/portfolio/projection/contributions-block/contributions-block";
import { IncomesBlock } from "@/features/portfolio/projection/incomes-block/incomes-block";
import { JourneyBlock } from "@/features/portfolio/projection/journey-block/journey-block";
import type { OtherIncome } from "@/features/portfolio/projection/model/other-income";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";
import { VersusBlock } from "@/features/portfolio/projection/versus-block/versus-block";
import { YearsBlock } from "@/features/portfolio/projection/years-block/years-block";

interface ProjectionBlocksProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"] | undefined;
  birthDate: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
  annualReal: number | null;
  onChanges: (changes: components["schemas"]["ProjectionChange"][]) => void;
  onIncomes: (incomes: OtherIncome[]) => void;
}

// The blocks under the plan section (PX6 to PX10, PX21); each task of the plan adds one.
export function ProjectionBlocks({
  draft,
  history,
  birthDate,
  baseline,
  annualReal,
  onChanges,
  onIncomes,
}: ProjectionBlocksProps) {
  if (history === undefined) return null;

  return (
    <>
      <JourneyBlock
        draft={draft}
        history={history}
        birthDate={birthDate}
        baseline={baseline}
      />

      <CasesBlock
        draft={draft}
        history={history}
        birthDate={birthDate}
        baseline={baseline}
      />

      <IncomesBlock
        draft={draft}
        history={history}
        birthDate={birthDate}
        onChange={onIncomes}
      />

      <VersusBlock
        draft={draft}
        history={history}
        birthDate={birthDate}
        baseline={baseline}
        annualReal={annualReal}
      />

      <ContributionsBlock
        draft={draft}
        history={history}
        birthDate={birthDate}
        onChange={onChanges}
      />

      <YearsBlock
        draft={draft}
        history={history}
        birthDate={birthDate}
        baseline={baseline}
      />
    </>
  );
}
