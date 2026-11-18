import { HelpShot } from "@/features/help/figure/help-shot";
import type {
  HelpFigure,
  HelpStep,
} from "@/features/help/model/parse-help-page";
import { HelpVideo } from "@/features/help/steps/help-video";
import { HelpStepLine } from "@/features/help/steps/help-step-line";
import styles from "@/features/help/styles/help.module.css";

interface HelpWalkStackedProps {
  steps: readonly HelpStep[];
  video?: HelpFigure | undefined;
}

// Below 1024 px of page each step is followed by its figure, and the video stands above the
// steps (help spec, HP5).
export function HelpWalkStacked({ steps, video }: HelpWalkStackedProps) {
  return (
    <div className={styles.walk} data-part="walk">
      {video !== undefined && (
        <div className={styles.clip}>
          <HelpVideo video={video} steps={steps} poster={steps[0]?.figure} />
        </div>
      )}

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li className={styles.step} key={step.markdown}>
            <span className={styles.stepLine}>
              <HelpStepLine number={index + 1} markdown={step.markdown} />
            </span>
            {step.figure !== undefined && (
              <figure className={[styles.figure, styles.stepFigure].join(" ")}>
                <HelpShot figure={step.figure} number={index + 1} />
              </figure>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
