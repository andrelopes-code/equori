import { useHelpMedia } from "@/features/help/media/use-help-media";
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
  const media = useHelpMedia();

  // A video the browser cannot play is left out; its steps and figures stay.
  const shown = media.video(video?.id) === undefined ? undefined : video;

  if (!steps.some((step) => step.figure !== undefined)) {
    return <HelpSteps steps={steps} />;
  }

  if (wide) return <HelpWalkBeside steps={steps} video={shown} />;

  return <HelpWalkStacked steps={steps} video={shown} />;
}
