import type { LinkOptions } from "@tanstack/react-router";

export type FirstStepId = "account" | "transactions" | "categories";

export interface FirstStep {
  id: FirstStepId;
  done: boolean;
  destination: LinkOptions;
}

export interface FirstStepsFacts {
  hasAccount: boolean;
  hasTransaction: boolean;
  hasUncategorized: boolean;
}

// The tasks without which the overview has nothing to show (design, Camada 3), in the order a
// newcomer does them; none once every task is done, so the block leaves the page by itself.
export function firstSteps(facts: FirstStepsFacts): FirstStep[] {
  const steps: FirstStep[] = [
    {
      id: "account",
      done: facts.hasAccount,
      destination: { to: "/accounts/new" },
    },
    {
      id: "transactions",
      done: facts.hasTransaction,
      destination: { to: "/transactions/new" },
    },
    {
      id: "categories",
      done: facts.hasTransaction && !facts.hasUncategorized,
      destination: { to: "/transactions", search: { uncategorized: true } },
    },
  ];

  return steps.every((s) => s.done) ? [] : steps;
}
