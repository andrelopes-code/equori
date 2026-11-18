import { HelpInline } from "@/features/help/steps/help-inline";
import styles from "@/features/help/styles/help.module.css";

interface HelpStepLineProps {
  number: number;
  markdown: string;
  links?: boolean | undefined;
}

// The number of a step and its text; the list around it says the order to a screen reader.
export function HelpStepLine({ number, markdown, links }: HelpStepLineProps) {
  return (
    <>
      <span className={styles.stepNumber} aria-hidden="true">
        {number}
      </span>
      <span className={styles.stepText}>
        <HelpInline markdown={markdown} links={links} />
      </span>
    </>
  );
}
