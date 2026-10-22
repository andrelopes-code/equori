import type { components } from "@/api/schema.gen";
import { groupOf } from "@/features/transactions/account-groups";

type Account = components["schemas"]["Account"];
type Placement = components["schemas"]["StatementPlacement"];

// What choosing an account does with the amount of the entry. Each variant needs data the
// application holds; without it there is no consequence.
export type Consequence =
  | { kind: "balance"; after: number; warning: boolean; reserve: boolean }
  | { kind: "statement"; dueDate: string; closedOn: string | null }
  | { kind: "limit"; after: number };

export interface ConsequenceInput {
  account: Account;
  // Minor units of the account's currency, zero or more.
  amount: number;
  // Money leaves the account on an expense or the source of a transfer.
  direction: "out" | "in";
  date: string;
  // Booked balance at the end of date, in the account's currency.
  balance: number | undefined;
  placement: Placement | undefined;
}

export function consequenceOf(input: ConsequenceInput): Consequence | null {
  const { account, amount, direction, date, balance, placement } = input;
  const signed = direction === "out" ? -amount : amount;
  if (groupOf(account) === "cards") {
    if (placement !== undefined) {
      const previous = placement.previous_closing_date;
      const previousDue = placement.previous_due_date;
      // A purchase after a closing and before that statement is due could be read as part
      // of it; the note says why it is not.
      const closedOn =
        previous !== undefined &&
        previousDue !== undefined &&
        date > previous &&
        date <= previousDue
          ? previous
          : null;
      return { kind: "statement", dueDate: placement.due_date, closedOn };
    }
    const free = account.card?.available_limit;
    if (free?.currency === account.currency) {
      return { kind: "limit", after: free.amount + signed };
    }
    return null;
  }
  // A liability's balance runs the other way; "what is left" has no meaning there.
  if (account.class !== "asset" || balance === undefined) return null;
  const after = balance + signed;
  const reserve = groupOf(account) === "reserves" && direction === "out";
  return { kind: "balance", after, warning: after < 0 || reserve, reserve };
}

// A card whose free limit cannot take the purchase is offered but cannot be chosen.
export function unavailableReason(
  account: Account,
  amount: number,
  direction: "out" | "in",
): "noFreeLimit" | null {
  const free = account.card?.available_limit;
  if (
    direction === "out" &&
    groupOf(account) === "cards" &&
    free?.currency === account.currency &&
    free.amount < amount
  ) {
    return "noFreeLimit";
  }
  return null;
}
