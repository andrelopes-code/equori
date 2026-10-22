import type { components } from "@/api/schema.gen";

type AssertionResult = components["schemas"]["AssertionResult"];
type Money = components["schemas"]["Money"];

export interface AssertionOutcome {
  kind: "reconciled" | "yield" | "adjustment" | "added" | "open";
  difference: Money;
  transactionId?: string;
}

// What an assertion or its resolution did, in the terms the tab states it (F6, S24, S26).
export function assertionOutcome(result: AssertionResult): AssertionOutcome {
  const transaction =
    result.resolution_transaction_id === undefined
      ? {}
      : { transactionId: result.resolution_transaction_id };
  switch (result.resolution) {
    case "none":
      return { kind: "reconciled", difference: result.difference };
    case "yield":
      return { kind: "yield", difference: result.difference, ...transaction };
    case "adjustment":
      return {
        kind: "adjustment",
        difference: result.difference,
        ...transaction,
      };
    case "transactions_added":
      return { kind: "added", difference: result.difference };
    default:
      return { kind: "open", difference: result.difference };
  }
}
