import type { components } from "@/api/schema.gen";

type AccountClass = components["schemas"]["Account"]["class"];

interface FlowTransaction {
  postings: { account_id: string; amount: { amount: number } }[];
  voided_at?: string | undefined;
}

export interface MonthFlows {
  income: number;
  spending: number;
  // Net amount moved from the scoped accounts to other balance accounts.
  moved: number;
}

// A transaction between two scoped accounts moves nothing out of the scope.
export function monthFlows(
  transactions: readonly FlowTransaction[],
  scope: ReadonlySet<string>,
  accounts: ReadonlyMap<string, { id: string; class: AccountClass }>,
): MonthFlows {
  const flows: MonthFlows = { income: 0, spending: 0, moved: 0 };
  for (const tx of transactions) {
    if (tx.voided_at !== undefined) continue;
    let scoped = 0;
    let earned = 0;
    let spent = 0;
    let category: AccountClass | undefined;
    let outside = false;
    for (const posting of tx.postings) {
      const account = accounts.get(posting.account_id);
      if (account === undefined) continue;
      if (scope.has(account.id)) scoped += posting.amount.amount;
      else if (account.class === "income" || account.class === "expense") {
        category = account.class;
        if (account.class === "income") earned -= posting.amount.amount;
        else spent += posting.amount.amount;
      } else outside = true;
    }
    if (scoped === 0) continue;
    if (category !== undefined && outside)
      addMixed(flows, scoped, earned, spent);
    else if (
      category === "income" ||
      (category === undefined && !outside && scoped > 0)
    )
      flows.income += scoped;
    else if (category === "expense") flows.spending -= scoped;
    else flows.moved -= scoped;
  }
  return flows;
}

// A transaction that also moves another balance account (a sale against its holding, a transfer
// with a fee) counts only its income or expense postings; the rest of the scoped amount moved.
function addMixed(
  flows: MonthFlows,
  scoped: number,
  earned: number,
  spent: number,
) {
  let part = 0;
  if (scoped > 0 && earned > 0) {
    part = Math.min(scoped, earned);
    flows.income += part;
  } else if (scoped < 0 && spent > 0) {
    part = -Math.min(-scoped, spent);
    flows.spending -= part;
  }
  flows.moved -= scoped - part;
}

export type Pace = "ok" | "ahead" | "over";

const aheadMargin = 0.15;

// Overspent is danger; ahead of the month's elapsed share by more than 15 points is warning.
export function budgetPace({
  spent,
  planned,
  elapsed,
}: {
  spent: number;
  planned: number;
  elapsed: number;
}): Pace {
  if (planned <= 0) return spent > 0 ? "over" : "ok";
  if (spent > planned) return "over";
  return spent / planned > elapsed + aheadMargin ? "ahead" : "ok";
}
