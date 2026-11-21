import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { ProgressBar } from "@slotted/react/progress-indicator";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { CategoryMark } from "@/features/categories";
import { BudgetActions } from "@/features/planning/budgets/budget-actions";
import styles from "@/features/planning/budgets/budgets.module.css";
import type { BudgetRow } from "@/features/planning/model/budget-month";
import { budgetState, usedShare } from "@/features/planning/model/budget-month";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/navigation/route-to";

type Money = components["schemas"]["Money"];
type Budget = components["schemas"]["Budget"];

const tones = { over: "danger", near: "warning", within: "accent" } as const;
const tags = {
  over: "budget.overspent",
  near: "budget.near",
  within: "budget.near",
} as const;

interface BudgetTableRowProps {
  row: BudgetRow;
  month: string;
  scale: (code: string) => number;
  onChangeAmount: (budget: Budget) => void;
  onDelete: (budget: Budget, name: string) => void;
}

// CP-04: one budget of the month on one line: who, its bar, how much of it went, what is left.
export function BudgetTableRow({
  row,
  month,
  scale,
  onChangeAmount,
  onDelete,
}: BudgetTableRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const p = row.progress;
  const state = budgetState(p);
  const share = usedShare(p);
  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const percent = numberFormatter(locale, { style: "percent" }).format(
    share / 100,
  );
  const rest =
    state === "over"
      ? t("budget.over", {
          amount: money({ ...p.available, amount: -p.available.amount }),
        })
      : t("budget.left", { amount: money(p.available) });
  // One line: what goals paid outside the budget comes before the carried balance (A257).
  const withCarried =
    p.carried.amount === 0
      ? rest
      : t("budget.restCarried", { rest, carried: money(p.carried) });
  const status =
    p.goal_paid.amount > 0
      ? t("budget.restGoalPaid", { rest, paid: money(p.goal_paid) })
      : withCarried;
  // Spent to exactly the limit is near by its share, but nothing is left: it reads as reached.
  const reached = state === "near" && p.available.amount === 0;
  const tag = reached ? "budget.reached" : tags[state];

  return (
    <TableRow value={row.budget.id} aria-label={row.label}>
      <TableRowHeader text="truncate">
        <Inline gap={3} wrap="nowrap" className={styles.title}>
          <CategoryMark
            name={row.entry.name}
            color={row.entry.color}
            icon={row.entry.icon}
          />
          <Link
            className={styles.name}
            render={routeTo({
              to: "/planning/budgets/$id",
              params: { id: row.budget.id },
              search: { month },
            })}
          >
            {row.label}
          </Link>
        </Inline>
      </TableRowHeader>
      <TableCell>
        <div className={styles.bar} data-state={state}>
          <ProgressBar
            size="sm"
            hideLabel
            label={t("budget.meter", { name: row.label })}
            value={share}
            tone={tones[state]}
            {...(state === "over" ? { valueText: t("budget.overspent") } : {})}
          />
          <Text
            size="sm"
            weight="semibold"
            numeric="tabular"
            aria-hidden="true"
          >
            {percent}
          </Text>
        </div>
      </TableCell>
      <TableCell numeric>
        <Text size="sm" weight="medium" numeric="tabular">
          {money(p.spent)}
        </Text>{" "}
        <Text size="sm" tone="muted" numeric="tabular">
          {t("budget.ofPlanned", { planned: money(p.planned) })}
        </Text>
      </TableCell>
      <TableCell text="truncate">
        <Inline gap={4} wrap="nowrap">
          {state !== "within" && (
            <Tag tone={tones[state]} size="sm">
              {t(tag)}
            </Tag>
          )}
          <Text
            size="sm"
            tone={state === "over" ? "danger" : "muted"}
            numeric="tabular"
            title={status}
          >
            {status}
          </Text>
        </Inline>
      </TableCell>
      <TableCell sticky="end">
        <BudgetActions
          row={row}
          month={month}
          onChangeAmount={onChangeAmount}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}
