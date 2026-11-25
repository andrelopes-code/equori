import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import type { ListRow } from "@/features/portfolio/contribution-plan/list/list-rows";
import styles from "@/features/portfolio/contribution-plan/list/plan-list.module.css";
import { PlanRow } from "@/features/portfolio/contribution-plan/list/plan-row";

type Plan = components["schemas"]["ContributionPlan"];

interface PlanListGroupProps {
  title: string;
  rows: ListRow[];
  view: Plan;
  base: number;
  openKey: string | undefined;
  onOpen: (row: ListRow) => void;
}

// The rows that share a state under its name.
export function PlanListGroup({
  title,
  rows,
  view,
  base,
  openKey,
  onOpen,
}: PlanListGroupProps) {
  return (
    <>
      <div className={styles.head}>
        <Text size="sm" weight="semibold" tone="muted">
          {title}
        </Text>
      </div>

      <ul className={styles.rows} aria-label={title}>
        {rows.map((row) => (
          <PlanRow
            key={row.key}
            row={row}
            view={view}
            base={base}
            open={row.key === openKey}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </>
  );
}
