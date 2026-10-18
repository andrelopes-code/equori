import styles from "@/ui/budget-bar.module.css";

// Families read: progress-indicator, sparkline. progress-indicator draws no second mark on its
// track, so the budget bar marks the month's elapsed share itself (complete frontend O6).
export function BudgetBar({
  share,
  pace,
  tone,
}: {
  // Spent over planned, from 0; above 1 the fill stops at the end.
  share: number;
  // The elapsed share of the month; absent for a past month or a fixed budget.
  pace?: number | undefined;
  tone: "neutral" | "warning" | "danger";
}) {
  const fill = Math.min(Math.max(share, 0), 1);
  return (
    <span data-own="budget-bar" data-tone={tone} className={styles.bar}>
      <span
        className={styles.fill}
        style={{ inlineSize: `${String(fill * 100)}%` }}
      />
      {pace !== undefined && (
        <span
          data-part-own="pace"
          className={styles.pace}
          style={{ insetInlineStart: `${String(Math.min(pace, 1) * 100)}%` }}
        />
      )}
    </span>
  );
}
