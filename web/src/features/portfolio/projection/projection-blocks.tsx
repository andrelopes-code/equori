import type { components } from "@/api/schema.gen";
import type { ProjectionDraft } from "@/features/portfolio/projection/model/plan-fields";

interface ProjectionBlocksProps {
  draft: ProjectionDraft;
  history: components["schemas"]["ReturnSeries"] | undefined;
  birthDate: string;
}

// The blocks under the plan section (PX6 to PX10); each task of the plan adds one.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the props are read by the blocks of Tasks 3 to 6.
export function ProjectionBlocks(props: ProjectionBlocksProps) {
  return null;
}
