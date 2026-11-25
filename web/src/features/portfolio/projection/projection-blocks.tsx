import type { components } from "@/api/schema.gen";
import { ContributionsBlock } from "@/features/portfolio/projection/contributions-block/contributions-block";
import { JourneyBlock } from "@/features/portfolio/projection/journey-block/journey-block";
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
}

// The blocks under the plan section (PX6 to PX10); each task of the plan adds one.
export function ProjectionBlocks({
  draft,
  history,
  birthDate,
  baseline,
  annualReal,
  onChanges,
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

      <VersusBlock
        draft={draft}
        history={history}
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
