export type FirstStepId = "account" | "transactions" | "categories";

export interface FirstStep {
  id: FirstStepId;
  done: boolean;
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
    { id: "account", done: facts.hasAccount },
    { id: "transactions", done: facts.hasTransaction },
    {
      id: "categories",
      done: facts.hasTransaction && !facts.hasUncategorized,
    },
  ];

  return steps.every((s) => s.done) ? [] : steps;
}
