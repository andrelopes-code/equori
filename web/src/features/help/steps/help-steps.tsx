import type { HelpStep } from "@/features/help/model/parse-help-page";
import { HelpStepLine } from "@/features/help/steps/help-step-line";
import styles from "@/features/help/styles/help.module.css";

interface HelpStepsProps {
  steps: readonly HelpStep[];
}

// Families read: stepper (states of a process the user is in), list (no numbered rail). Numbered
// steps read the same on every page of the help; this screen's form.
export function HelpSteps({ steps }: HelpStepsProps) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        <li className={styles.step} key={step.markdown}>
          <span className={styles.stepLine}>
            <HelpStepLine number={index + 1} markdown={step.markdown} />
          </span>
        </li>
      ))}
    </ol>
  );
}
