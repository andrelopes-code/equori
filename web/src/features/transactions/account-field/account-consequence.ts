import type { components } from "@/api/schema.gen";
import type { Operation } from "@/features/transactions/account-field/account-operation";
import { groupOf } from "@/features/transactions/model/account-groups";

type Account = components["schemas"]["Account"];
type Placement = components["schemas"]["StatementPlacement"];

// What choosing an account does with the amount of the entry, stated only where it changes
// the decision. Each variant needs data the application holds; without it there is no
// consequence.
export type Consequence =
  | { kind: "overdraw"; after: number }
  | { kind: "reserve"; after: number }
  | { kind: "statement"; dueDate: string; closedOn: string | null }
  | { kind: "settles"; dueDate: string };

export interface ConsequenceInput {
  account: Account;
  // Minor units of `currency`, zero or more.
  amount: number;
  operation: Operation;
  // The entry's currency; an account in another currency has no consequence.
  currency: string;
  date: string;
  // Booked balance at the end of date, in the account's currency.
  balance: number | undefined;
  placement: Placement | undefined;
}

export interface Unavailable {
  reason: "noFreeLimit";
  missing: number;
}

export function consequenceOf(input: ConsequenceInput): Consequence | null {
  const { account, amount, operation, currency } = input;
  if (account.currency !== currency) return null;
  if (groupOf(account) === "cards") return cardConsequence(input);

  const { balance } = input;
  // A liability's balance runs the other way; "what is left" has no meaning there.
  if (account.class !== "asset" || balance === undefined) return null;
  if (amount <= 0 || !leavesAccount(operation)) return null;

  const after = balance - amount;
  if (after < 0) return { kind: "overdraw", after };
  if (groupOf(account) === "reserves") return { kind: "reserve", after };

  return null;
}

// A card whose free limit cannot take the purchase is offered but cannot be chosen.
export function unavailableOf(
  account: Account,
  amount: number,
  operation: Operation,
  currency: string,
): Unavailable | null {
  const free = account.card?.available_limit;
  if (
    !leavesAccount(operation) ||
    groupOf(account) !== "cards" ||
    account.currency !== currency ||
    free?.currency !== account.currency ||
    free.amount >= amount
  ) {
    return null;
  }

  return { reason: "noFreeLimit", missing: amount - free.amount };
}

function cardConsequence(input: ConsequenceInput): Consequence | null {
  const { operation, placement } = input;
  if (placement === undefined) return null;
  if (operation === "transfer-in") {
    return { kind: "settles", dueDate: placement.due_date };
  }
  if (operation === "income") return null;

  return {
    kind: "statement",
    dueDate: placement.due_date,
    closedOn: closedOn(input.date, placement),
  };
}

// A purchase after a closing and before that statement is due could be read as part of it;
// the note says why it is not.
function closedOn(date: string, placement: Placement): string | null {
  const previous = placement.previous_closing_date;
  const previousDue = placement.previous_due_date;
  if (previous === undefined || previousDue === undefined) return null;

  return date > previous && date <= previousDue ? previous : null;
}

// Money leaves the account on an expense or the source of a transfer.
function leavesAccount(operation: Operation): boolean {
  return operation === "expense" || operation === "transfer-out";
}
