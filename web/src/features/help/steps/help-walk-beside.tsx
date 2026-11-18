import { useState } from "react";

import type {
  HelpFigure,
  HelpStep,
} from "@/features/help/model/parse-help-page";
import { HelpStage } from "@/features/help/steps/help-stage";
import type { HelpStageMode } from "@/features/help/steps/help-stage";
import { HelpStepLine } from "@/features/help/steps/help-step-line";
import styles from "@/features/help/styles/help.module.css";

interface HelpWalkBesideProps {
  steps: readonly HelpStep[];
  video?: HelpFigure | undefined;
}

// Families read: stepper (states of a process, not a list that drives a figure), carousel (slides
// without a list). From 1024 px of page the steps stand beside one figure and choose what it
// shows (help spec, HP5); this screen's form.
export function HelpWalkBeside({ steps, video }: HelpWalkBesideProps) {
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<HelpStageMode>("figures");

  const handleCurrent = (index: number) => {
    setCurrent(index);
    setMode("figures");
  };

  return (
    <div className={styles.walk} data-part="walk">
      <ol className={[styles.steps, styles.stepsPick].join(" ")}>
        {steps.map((step, index) => (
          <li className={styles.step} key={step.markdown}>
            <button
              type="button"
              className={[styles.stepLine, styles.stepButton].join(" ")}
              data-current={index === current ? "" : undefined}
              aria-current={index === current ? "step" : undefined}
              onClick={() => {
                handleCurrent(index);
              }}
            >
              <HelpStepLine
                number={index + 1}
                markdown={step.markdown}
                links={false}
              />
            </button>
          </li>
        ))}
      </ol>

      <HelpStage
        steps={steps}
        current={current}
        onCurrentChange={handleCurrent}
        video={video}
        mode={mode}
        onModeChange={setMode}
      />
    </div>
  );
}
