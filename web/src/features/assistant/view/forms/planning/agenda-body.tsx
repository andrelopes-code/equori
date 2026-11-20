import { AgendaWeek } from "@/features/assistant/view/forms/planning/agenda-week";
import type { AgendaData } from "@/features/assistant/view/forms/planning/planning-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";

// The commitments ahead, grouped by week with each week's total.
export function AgendaBody({ data }: FormBodyProps) {
  const { weeks } = data as AgendaData;

  return (
    <ul className={styles.events}>
      {weeks.map((week) => (
        <AgendaWeek key={week.start} week={week} />
      ))}
    </ul>
  );
}
