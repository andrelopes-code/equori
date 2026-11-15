import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  bpFromText,
  textFromBp,
} from "@/features/planning/budget-plan/plan-math";
import type { MessageKey } from "@/i18n/catalog.en";

type Bucket = components["schemas"]["BudgetPlanBucket"];
type BucketsInput = components["schemas"]["BudgetBucketsInput"];

export interface DraftBucket {
  key: string;
  name: string;
  // The share as the reader types it, a percentage with one decimal.
  share: string;
  takesSavings: boolean;
}

// A category's choice: a bucket key, outsideChoice (roots only) or sameChoice (subcategories
// only, following the parent).
export const outsideChoice = "outside";
export const sameChoice = "same";

export interface BucketDraft {
  buckets: DraftBucket[];
  choices: Map<string, string>;
  // The top-level categories, whose default is outsideChoice.
  roots: ReadonlySet<string>;
}

export type PresetName = "503020" | "six" | "scratch";

// The starting points of income buckets A232: catalog name keys and shares in basis points.
export const presets: Record<
  PresetName,
  readonly { name: MessageKey; share: number; savings?: true }[]
> = {
  "503020": [
    { name: "buckets.name.needs", share: 5000 },
    { name: "buckets.name.wants", share: 3000 },
    { name: "buckets.name.savings", share: 2000, savings: true },
  ],
  six: [
    { name: "buckets.name.fixed", share: 3000 },
    { name: "buckets.name.comfort", share: 1500 },
    { name: "buckets.name.goals", share: 1500 },
    { name: "buckets.name.pleasures", share: 1000 },
    { name: "buckets.name.freedom", share: 2500, savings: true },
    { name: "buckets.name.knowledge", share: 500 },
  ],
  scratch: [{ name: "buckets.name.essentials", share: 10000 }],
};

export const maxBuckets = 10;

// The draft of a stored method: every root of the tree starts outside and every
// subcategory follows its parent unless the method places it.
export function initialDraft(
  buckets: readonly Bucket[] | undefined,
  entries: readonly CategoryEntry[],
): BucketDraft {
  const roots = new Set(
    entries.filter((e) => e.parentId === undefined).map((e) => e.id),
  );
  const choices = new Map<string, string>();
  for (const e of entries)
    choices.set(e.id, roots.has(e.id) ? outsideChoice : sameChoice);
  for (const b of buckets ?? [])
    for (const id of b.category_ids) choices.set(id, b.id);
  return {
    buckets: (buckets ?? []).map((b) => ({
      key: b.id,
      name: b.name,
      share: textFromBp(b.share_bp),
      takesSavings: b.takes_savings,
    })),
    choices,
    roots,
  };
}

// Replaces the buckets with a preset's; a bucket whose name stays keeps its key, so its
// categories stay with it, and a category of a dropped bucket returns to its default.
export function applyPreset(
  draft: BucketDraft,
  preset: PresetName,
  name: (key: MessageKey) => string,
  newKey: () => string,
): BucketDraft {
  const byName = new Map(
    draft.buckets.map((b) => [b.name.trim().toLowerCase(), b.key]),
  );
  const buckets = presets[preset].map((p) => {
    const label = name(p.name);
    return {
      key: byName.get(label.toLowerCase()) ?? newKey(),
      name: label,
      share: textFromBp(p.share),
      takesSavings: p.savings === true,
    };
  });
  return { ...draft, buckets, choices: keepChoices(draft, buckets) };
}

// The choices of the draft with each choice of a missing bucket returned to its default: a
// root outside the split, a subcategory following its parent.
export function keepChoices(
  draft: BucketDraft,
  buckets: readonly DraftBucket[],
): Map<string, string> {
  const keys = new Set(buckets.map((b) => b.key));
  const out = new Map<string, string>();
  for (const [id, choice] of draft.choices) {
    const kept =
      choice === outsideChoice || choice === sameChoice || keys.has(choice);
    const fallback = draft.roots.has(id) ? outsideChoice : sameChoice;
    out.set(id, kept ? choice : fallback);
  }
  return out;
}

// The sum of the shares in basis points; undefined when a share is not a number.
export function totalBp(buckets: readonly DraftBucket[]): number | undefined {
  let total = 0;
  for (const b of buckets) {
    const bp = bpFromText(b.share);
    if (bp === undefined) return undefined;
    total += bp;
  }
  return total;
}

// The draft can be saved: every bucket has a name and the shares sum to the whole.
export function canSave(draft: BucketDraft): boolean {
  return (
    draft.buckets.length > 0 &&
    draft.buckets.every((b) => b.name.trim() !== "") &&
    totalBp(draft.buckets) === 10_000
  );
}

// The body of saveBudgetBuckets: each bucket lists the categories whose choice names it.
export function bucketsPayload(draft: BucketDraft): BucketsInput {
  return {
    buckets: draft.buckets.map((b) => ({
      name: b.name.trim(),
      share_bp: bpFromText(b.share) ?? 0,
      takes_savings: b.takesSavings,
      category_ids: [...draft.choices]
        .filter(([, choice]) => choice === b.key)
        .map(([id]) => id),
    })),
  };
}

export interface CategoryBranch {
  root: CategoryEntry;
  subcategories: CategoryEntry[];
}

// The open expense categories as branches of the tree, in the tree's order: each top-level
// category with every category below it.
export function expenseBranches(
  entries: readonly CategoryEntry[],
): CategoryBranch[] {
  const open = entries.filter(
    (e) => e.class === "expense" && !e.archived && !e.uncategorized,
  );
  const parents = new Map(open.map((e) => [e.id, e.parentId]));
  const rootOf = (id: string): string => {
    const seen = new Set<string>();
    let at = id;
    let parent = parents.get(at);
    while (parent !== undefined && parents.has(parent) && !seen.has(parent)) {
      seen.add(at);
      at = parent;
      parent = parents.get(at);
    }
    return at;
  };
  const branches = new Map<string, CategoryBranch>();
  for (const e of open)
    if (e.parentId === undefined)
      branches.set(e.id, { root: e, subcategories: [] });
  for (const e of open) {
    if (e.parentId === undefined) continue;
    branches.get(rootOf(e.id))?.subcategories.push(e);
  }
  return [...branches.values()];
}
