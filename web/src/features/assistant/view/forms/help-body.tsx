import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import styles from "@/features/assistant/view/forms/forms.module.css";

interface HelpData {
  screens: { path: string; screen: string; tasks: string[] }[];
}

// A guide article as numbered steps: the tasks of its screens, in order.
export function HelpBody({ data }: FormBodyProps) {
  const steps = (data as HelpData).screens.flatMap((s) =>
    s.tasks.map((task) => `${s.screen}: ${task}`),
  );

  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        <li key={step}>
          <span className={styles.stepN}>{index + 1}</span>
          <span className={styles.rowName}>{step}</span>
        </li>
      ))}
    </ol>
  );
}
