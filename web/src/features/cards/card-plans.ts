import type { components } from "@/api/schema.gen";

type InstallmentPlan = components["schemas"]["InstallmentPlan"];
type Money = components["schemas"]["Money"];

// The plans billed on the statements read, each once, in the order first met.
export function planIDs(
  statements: readonly {
    postings: readonly { installment?: { plan_id: string } | undefined }[];
  }[],
): string[] {
  const seen: string[] = [];
  for (const statement of statements) {
    for (const posting of statement.postings) {
      const id = posting.installment?.plan_id;
      if (id !== undefined && !seen.includes(id)) seen.push(id);
    }
  }
  return seen;
}

// Where a plan stands against the open statement: installments billed so far, what the later
// statements still hold (reversed ones excluded) and the statement of the last one.
export function planProgress(
  plan: InstallmentPlan,
  openReference: string,
): { billed: number; remaining: Money; each: Money; last: string | undefined } {
  const currency = plan.installments[0]?.amount.currency ?? "BRL";
  const live = plan.installments.filter((i) => !i.reversed);
  return {
    billed: live.filter((i) => i.statement <= openReference).length,
    remaining: {
      amount: live
        .filter((i) => i.statement > openReference)
        .reduce((sum, i) => sum + i.amount.amount, 0),
      currency,
    },
    each: plan.installments[0]?.amount ?? { amount: 0, currency },
    last: plan.installments[plan.installments.length - 1]?.statement,
  };
}
