import type { NavigateOptions } from "@tanstack/react-router";

import { accountRoute } from "@/features/accounts";
import type {
  AttentionItem,
  ReviewSegment,
} from "@/features/overview/attention/attention";

// Where an item leads. A budget opens at the month the widget reads.
export function itemDestination(
  item: AttentionItem,
  month: string,
): NavigateOptions | undefined {
  switch (item.kind) {
    case "statement":
      return statementRoute(item.account.id, item.statement.id);
    case "connections":
      return { to: "/accounts/links" };
    case "budget":
      return {
        to: "/planning/budgets/$id",
        params: { id: item.id },
        search: { month },
      };
    case "difference":
      return item.account.kind === "credit_card"
        ? accountRoute(item.account)
        : { ...accountRoute(item.account), search: { tab: "reconciliation" } };
    // The record link of a payment needs the scale of its instrument: its row builds it.
    case "review":
    case "fixed_income_due":
    case "fixed_income_week":
      return undefined;
  }
}

export function segmentDestination(segment: ReviewSegment): NavigateOptions {
  if (segment.kind === "uncategorized")
    return { to: "/transactions", search: { uncategorized: true } };
  if (segment.statementId !== undefined)
    return statementRoute(segment.account.id, segment.statementId);

  return accountRoute(segment.account);
}

function statementRoute(
  accountId: string,
  statementId: string,
): NavigateOptions {
  return {
    to: "/cards/$accountId/statements/$statementId",
    params: { accountId, statementId },
  };
}
