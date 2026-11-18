import type { components } from "@/api/schema.gen";
import type {
  ClassDraft,
  PlanDraft,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";

type Outside = components["schemas"]["ContributionOutside"];

export interface TypedEntry {
  entry: Outside;
  type: string;
}

const total = 10000n;

// CN12: one class per instrument type in order of first appearance, each entry a member of its
// type's class, each class target its share of the values in basis points. Shares round down; the
// remainder goes to the largest class, the first of equals. An entry without a value is a member
// with no weight in the shares.
export function planFromPortfolio(
  entries: readonly TypedEntry[],
  label: (type: string) => string,
): PlanDraft {
  const types = [...new Set(entries.map((e) => e.type))];
  const values = types.map((type) =>
    entries
      .filter((e) => e.type === type)
      .reduce((sum, e) => sum + BigInt(e.entry.value?.amount ?? 0), 0n),
  );
  const shares = shareBasisPoints(values);

  return {
    classes: types.map((type, i): ClassDraft => ({
      name: label(type),
      targetBp: shares[i] ?? 0,
      byQuestions: false,
      questions: [],
      members: entries
        .filter((e) => e.type === type)
        .map((e) => memberRefOf(e.entry)),
    })),
  };
}

// The instrument type of an entry: an account is a CN3 account, counted as a currency.
export function typeOfEntry(
  entry: Outside,
  types: ReadonlyMap<string, string>,
): string {
  if (entry.account_id !== undefined) return "currency";

  return types.get(entry.instrument ?? "") ?? entry.instrument ?? "";
}

export function memberRefOf(entry: Outside): MemberRef {
  return {
    ...(entry.account_id === undefined ? {} : { accountId: entry.account_id }),
    ...(entry.instrument === undefined ? {} : { instrument: entry.instrument }),
  };
}

function shareBasisPoints(values: readonly bigint[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0n);
  const floors = values.map((v) => (sum === 0n ? 0n : (v * total) / sum));
  const largest = values.reduce(
    (best, v, i) => (v > (values[best] ?? 0n) ? i : best),
    0,
  );
  const remainder = total - floors.reduce((a, b) => a + b, 0n);

  return floors.map((f, i) => Number(i === largest ? f + remainder : f));
}
