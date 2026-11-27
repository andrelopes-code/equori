import type { components } from "@/api/schema.gen";
import type {
  ClassDraft,
  PlanDraft,
  Rule,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";

type Outside = components["schemas"]["ContributionOutside"];
type Kind = NonNullable<Outside["return_kind"]>;

export interface TypedEntry {
  entry: Outside;
  type: string;
  // The return kind of a fixed income entry (GR3), from `entry.return_kind`.
  returnKind?: Kind;
}

interface Group {
  name: string;
  rules: Rule[];
  entries: TypedEntry[];
}

const total = 10000n;

// GR9 over CN12: a fixed income entry with a return kind joins the class of its kind, which holds
// the rule `{instrument_type: fixed_income, return_kind}` and no member; any other entry joins
// the class of its type as a member. Classes come in order of first appearance, each target its
// share of the values in basis points. Shares round down; the remainder goes to the largest
// class, the first of equals. An entry without a value or below zero has no weight in the shares.
export function planFromPortfolio(
  entries: readonly TypedEntry[],
  label: (type: string) => string,
  kindLabel: (kind: Kind) => string,
): PlanDraft {
  const groups = groupEntries(entries, label, kindLabel);
  const values = groups.map((g) =>
    g.entries.reduce((sum, e) => sum + BigInt(e.entry.value?.amount ?? 0), 0n),
  );
  const shares = shareBasisPoints(values);

  return {
    classes: groups.map((g, i): ClassDraft => ({
      name: g.name,
      targetBp: shares[i] ?? 0,
      byQuestions: false,
      questions: [],
      questionFacts: [],
      questionLimits: [],
      rules: g.rules,
      members:
        g.rules.length > 0 ? [] : g.entries.map((e) => memberRefOf(e.entry)),
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

function groupEntries(
  entries: readonly TypedEntry[],
  label: (type: string) => string,
  kindLabel: (kind: Kind) => string,
): Group[] {
  const groups = new Map<string, Group>();

  for (const e of entries) {
    const kind = e.type === "fixed_income" ? e.returnKind : undefined;
    const key = kind === undefined ? `type:${e.type}` : `kind:${kind}`;
    const group = groups.get(key) ?? {
      name: kind === undefined ? label(e.type) : kindLabel(kind),
      rules:
        kind === undefined
          ? []
          : [{ instrument_type: "fixed_income", return_kind: kind }],
      entries: [],
    };

    group.entries.push(e);
    groups.set(key, group);
  }

  return [...groups.values()];
}

// A negative value, such as brokerage cash below zero (PC4), weighs 0.
function shareBasisPoints(amounts: readonly bigint[]): number[] {
  const values = amounts.map((v) => (v > 0n ? v : 0n));
  const sum = values.reduce((a, b) => a + b, 0n);
  const floors = values.map((v) => (sum === 0n ? 0n : (v * total) / sum));
  const largest = values.reduce(
    (best, v, i) => (v > (values[best] ?? 0n) ? i : best),
    0,
  );
  const remainder = total - floors.reduce((a, b) => a + b, 0n);

  return floors.map((f, i) => Number(i === largest ? f + remainder : f));
}
