import { Text } from "@slotted/react/typography";

import type { GoalLine } from "@/features/goals/goal-line";
import styles from "@/features/goals/goals-page.module.css";
import { MonthlyControl } from "@/features/goals/monthly-control";
import { formatDate, formatMoney, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { BudgetBar } from "@/ui/budget-bar";

// Complete frontend R5-3: a phone shows one block per goal.
export function GoalBlocks({
  lines,
  onMonthly,
}: {
  lines: GoalLine[];
  onMonthly: (id: string, major: number) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <ul className={styles.blocks} aria-label={t("goals.title")}>
      {lines.map((line) => (
        <li key={line.goal.id} className={styles.goalBlock}>
          <span className={styles.blockRow}>
            <Text weight="medium">{line.goal.name}</Text>
            <span data-late={line.late} className={styles.ready}>
              {line.ready !== null && formatReferenceMonth(line.ready, locale)}
            </span>
          </span>
          <span className={styles.blockRow}>
            <Text size="sm" tone="muted">
              {t("goals.of", {
                saved: formatMoney(line.goal.current, line.scale, locale),
                target: formatMoney(line.goal.target, line.scale, locale),
              })}
            </Text>
            <Text size="sm" tone="muted">
              {t("goals.due", { date: formatDate(line.goal.due_on, locale) })}
            </Text>
          </span>
          <BudgetBar share={line.goal.progress_bp / 10000} tone="neutral" />
          <MonthlyControl
            goal={line.goal.name}
            major={line.major}
            unit={line.unit}
            currency={line.goal.target.currency}
            scale={line.scale}
            onChange={(major) => {
              onMonthly(line.goal.id, major);
            }}
          />
        </li>
      ))}
    </ul>
  );
}
