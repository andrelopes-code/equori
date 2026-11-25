import type { components } from "@/api/schema.gen";
import { JourneyBlock } from "@/features/portfolio/projection/journey-block/journey-block";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";

interface ProjectionBlocksProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"] | undefined;
  birthDate: string;
  baseline: components["schemas"]["ProjectionBaseline"] | undefined;
}

// The blocks under the plan section (PX6 to PX10); each task of the plan adds one.
export function ProjectionBlocks({
  draft,
  history,
  birthDate,
  baseline,
}: ProjectionBlocksProps) {
  if (history === undefined) return null;

  return (
    <JourneyBlock
      draft={draft}
      history={history}
      birthDate={birthDate}
      baseline={baseline}
    />
  );
}
