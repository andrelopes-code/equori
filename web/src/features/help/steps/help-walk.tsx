import type {
  HelpFigure,
  HelpStep,
} from "@/features/help/model/parse-help-page";
import { HelpSteps } from "@/features/help/steps/help-steps";
import { HelpWalkBeside } from "@/features/help/steps/help-walk-beside";
import { HelpWalkStacked } from "@/features/help/steps/help-walk-stacked";
import { usePageWide } from "@/ui/runtime/use-page-wide";

interface HelpWalkProps {
  steps: readonly HelpStep[];
  video?: HelpFigure | undefined;
}

// The steps of a task: beside their figure on a wide page, each followed by it on a narrow one,
// and the numbered list alone when no step has a figure.
export function HelpWalk({ steps, video }: HelpWalkProps) {
  const wide = usePageWide();

  if (!steps.some((step) => step.figure !== undefined)) {
    return <HelpSteps steps={steps} />;
  }

  if (wide) return <HelpWalkBeside steps={steps} video={video} />;

  return <HelpWalkStacked steps={steps} video={video} />;
}
