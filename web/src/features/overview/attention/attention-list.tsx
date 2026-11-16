import { List } from "@slotted/react/list";

import type { AttentionItem } from "@/features/overview/attention/attention";
import { BudgetRow } from "@/features/overview/attention/budget-row";
import { ConnectionsRow } from "@/features/overview/attention/connections-row";
import { DifferenceRow } from "@/features/overview/attention/difference-row";
import { FixedIncomeDueRow } from "@/features/overview/attention/fixed-income-due-row";
import { FixedIncomeWeekRow } from "@/features/overview/attention/fixed-income-week-row";
import { QuietBudgetRow } from "@/features/overview/attention/quiet-budget-row";
import { ReviewRow } from "@/features/overview/attention/review-row";
import { StatementHero } from "@/features/overview/attention/statement-hero";
import { StatementRow } from "@/features/overview/attention/statement-row";

// The items in the order they come ranked: the weight of each sets the element that draws it.
export function AttentionList({
  items,
  month,
  label,
}: {
  items: readonly AttentionItem[];
  month: string;
  label: string;
}) {
  return (
    <List aria-label={label}>
      {items.map((item) => {
        switch (item.kind) {
          case "statement":
            return item.weight === "critical" ? (
              <StatementHero key={item.statement.id} item={item} />
            ) : (
              <StatementRow key={item.statement.id} item={item} />
            );
          case "connections":
            return <ConnectionsRow key={item.kind} count={item.count} />;
          case "budget":
            return item.weight === "normal" ? (
              <BudgetRow key={item.id} item={item} month={month} />
            ) : (
              <QuietBudgetRow key={item.id} item={item} month={month} />
            );
          case "review":
            return <ReviewRow key={item.kind} item={item} />;
          case "difference":
            return <DifferenceRow key={item.account.id} item={item} />;
          case "fixed_income_due":
            return (
              <FixedIncomeDueRow
                key={`${item.event.account_id}/${item.event.instrument}/${item.event.date}/${item.event.kind}`}
                item={item}
              />
            );
          case "fixed_income_week":
            return <FixedIncomeWeekRow key={item.kind} item={item} />;
        }
      })}
    </List>
  );
}
