import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import type { GoalLine } from "@/features/goals/goal-line";
import styles from "@/features/goals/goals-page.module.css";
import { MonthlyControl } from "@/features/goals/monthly-control";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { BudgetBar } from "@/ui/budget-bar";
import { MoneyText } from "@/ui/money-text";

// Complete frontend R5-1: one row per goal, the totals in the summary row.
export function GoalsTable({
  lines,
  total,
  onMonthly,
}: {
  lines: GoalLine[];
  total: { saved: number; target: number; currency: string; scale: number };
  onMonthly: (id: string, major: number) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <Table columns={6}>
      <TableContent>
        <TableCaption>
          <VisuallyHidden>{t("goals.title")}</VisuallyHidden>
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("goals.goal")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("goals.saved")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("goals.target")}</TableColumnHeader>
            <TableColumnHeader>
              <VisuallyHidden>{t("goals.progress")}</VisuallyHidden>
            </TableColumnHeader>
            <TableColumnHeader>{t("goals.monthly")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("goals.ready")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.goal.id}>
              <TableRowHeader>
                <span className={styles.name}>
                  {line.goal.name}
                  <Text size="xs" tone="muted">
                    {t("goals.due", {
                      date: formatDate(line.goal.due_on, locale),
                    })}
                  </Text>
                </span>
              </TableRowHeader>
              <TableCell numeric text="nowrap">
                <MoneyText
                  money={line.goal.current}
                  scale={line.scale}
                  symbol={false}
                />
              </TableCell>
              <TableCell numeric text="nowrap">
                <span className={styles.muted}>
                  <MoneyText
                    money={line.goal.target}
                    scale={line.scale}
                    symbol={false}
                  />
                </span>
              </TableCell>
              <TableCell>
                <BudgetBar
                  share={line.goal.progress_bp / 10000}
                  tone="neutral"
                />
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell numeric text="nowrap">
                <span data-late={line.late} className={styles.ready}>
                  {line.ready !== null &&
                    formatReferenceMonth(line.ready, locale)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableSummary>
          <TableRow>
            <TableRowHeader>{t("goals.total")}</TableRowHeader>
            <TableCell numeric text="nowrap">
              <MoneyText
                money={{ amount: total.saved, currency: total.currency }}
                scale={total.scale}
                symbol={false}
              />
            </TableCell>
            <TableCell numeric text="nowrap">
              <MoneyText
                money={{ amount: total.target, currency: total.currency }}
                scale={total.scale}
                symbol={false}
              />
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
        </TableSummary>
      </TableContent>
    </Table>
  );
}
