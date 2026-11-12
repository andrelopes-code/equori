import type { components } from "@/api/schema.gen";
import type { Operation } from "@/features/transactions/account-field/account-operation";

type Kind = components["schemas"]["Account"]["kind"];

const unlisted = 99;

const transferOut: readonly Kind[] = [
  "checking",
  "savings",
  "cash",
  "benefit",
  "reserve",
  "brokerage",
];

const primaryKinds: Record<Operation, readonly Kind[]> = {
  expense: ["checking", "cash", "benefit", "credit_card"],
  income: ["checking", "savings", "cash", "benefit"],
  "transfer-out": transferOut,
  "transfer-in": [...transferOut, "credit_card"],
};

// R4: an account without a kind is primary.
export function isPrimary(operation: Operation, kind: Kind): boolean {
  return kind === undefined || primaryKinds[operation].includes(kind);
}

// R5: the position of the kind in the R4 list of the operation.
export function kindRank(operation: Operation, kind: Kind): number {
  const index = primaryKinds[operation].indexOf(kind);

  return index < 0 ? unlisted : index;
}
