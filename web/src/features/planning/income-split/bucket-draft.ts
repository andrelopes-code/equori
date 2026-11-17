import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  bpFromText,
  textFromBp,
} from "@/features/planning/budget-plan/plan-math";
import type { MessageKey } from "@/i18n/catalog.en";

type Bucket = components["schemas"]["BudgetBucket"];
type BucketsInput = components["schemas"]["BudgetBucketsInput"];

export interface DraftBucket {
  key: string;
  // The stored id; absent on a bucket added in the dialog or by a preset (A241).
  id?: string;
  name: string;
  // The share as the reader types it, a percentage with one decimal.
  share: string;
  measure: BucketMeasure;
}

// How a bucket reads its target (income buckets A234): a ceiling to stay under, a floor to reach,
// the month's savings, or what went into the goals (a floor too).
export const bucketMeasures = ["ceiling", "floor", "savings", "goals"] as const;
export type BucketMeasure = (typeof bucketMeasures)[number];

// The measures one bucket of a method holds at most.
const singleMeasures: readonly BucketMeasure[] = ["savings", "goals"];

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
  readonly { name: MessageKey; share: number; measure?: BucketMeasure }[]
> = {
  "503020": [
    { name: "buckets.name.needs", share: 5000 },
    { name: "buckets.name.wants", share: 3000 },
    { name: "buckets.name.savings", share: 2000, measure: "savings" },
  ],
  six: [
    { name: "buckets.name.fixed", share: 3000 },
    { name: "buckets.name.comfort", share: 1500 },
    { name: "buckets.name.goals", share: 1500, measure: "goals" },
    { name: "buckets.name.pleasures", share: 1000 },
    { name: "buckets.name.freedom", share: 2500, measure: "savings" },
    { name: "buckets.name.knowledge", share: 500, measure: "floor" },
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
      id: b.id,
      name: b.name,
      share: textFromBp(b.share_bp),
      measure: measureOf(b),
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
      measure: p.measure ?? "ceiling",
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

// The buckets with change applied to the bucket of key; a measure one bucket holds at most
// returns the bucket that held it before to a ceiling.
export function changeBucket(
  buckets: readonly DraftBucket[],
  key: string,
  change: Partial<DraftBucket>,
): DraftBucket[] {
  const single =
    change.measure !== undefined && singleMeasures.includes(change.measure);
  return buckets.map((b) => {
    if (b.key === key) return { ...b, ...change };
    return single && b.measure === change.measure
      ? { ...b, measure: "ceiling" }
      : b;
  });
}

// The measure of a stored bucket; the savings take precedence, then the goals.
export function measureOf(
  b: Pick<Bucket, "takes_savings" | "takes_goals" | "at_least">,
): BucketMeasure {
  if (b.takes_savings) return "savings";
  if (b.takes_goals) return "goals";
  return b.at_least ? "floor" : "ceiling";
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

// The body of saveBudgetBuckets: each bucket lists the categories whose choice names it; from
// is the first month of the version.
export function bucketsPayload(
  draft: BucketDraft,
  from?: string,
): BucketsInput {
  return {
    ...(from === undefined ? {} : { from }),
    buckets: draft.buckets.map((b) => ({
      ...(b.id === undefined ? {} : { id: b.id }),
      name: b.name.trim(),
      share_bp: bpFromText(b.share) ?? 0,
      ...measureFlags(b.measure),
      category_ids: [...draft.choices]
        .filter(([, choice]) => choice === b.key)
        .map(([id]) => id),
    })),
  };
}

// The flags of saveBudgetBuckets for a measure: the goals bucket is a floor.
function measureFlags(measure: BucketMeasure) {
  return {
    takes_savings: measure === "savings",
    takes_goals: measure === "goals",
    at_least: measure === "goals" || measure === "floor",
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

// The choice a stored method gives a category: its bucket, or the default of its place.
export function choiceOf(
  method: readonly Bucket[],
  categoryId: string,
  isRoot: boolean,
): string {
  const bucket = method.find((b) => b.category_ids.includes(categoryId));
  if (bucket !== undefined) return bucket.id;
  return isRoot ? outsideChoice : sameChoice;
}

// The body that saves method with one category moved to choice; the other categories stay.
export function withChoice(
  method: readonly Bucket[],
  categoryId: string,
  choice: string,
): BucketsInput {
  return {
    buckets: method.map((b) => {
      const others = b.category_ids.filter((id) => id !== categoryId);
      return {
        id: b.id,
        name: b.name,
        share_bp: b.share_bp,
        takes_savings: b.takes_savings,
        takes_goals: b.takes_goals,
        at_least: b.at_least,
        category_ids: b.id === choice ? [...others, categoryId] : others,
      };
    }),
  };
}

// The top-level expense categories the draft leaves outside the split.
export function outsideRoots(
  draft: BucketDraft,
  branches: readonly CategoryBranch[],
): CategoryEntry[] {
  return branches
    .map((b) => b.root)
    .filter((root) => draft.choices.get(root.id) === outsideChoice);
}

// The bucket key a category draws from in the draft: its own choice, or its parent's when it
// follows it; undefined outside the split.
export function effectiveChoice(
  draft: BucketDraft,
  parents: ReadonlyMap<string, string | undefined>,
  categoryId: string,
): string | undefined {
  const seen = new Set<string>();
  let id: string | undefined = categoryId;
  while (id !== undefined && !seen.has(id)) {
    seen.add(id);
    const choice = draft.choices.get(id);
    if (choice === outsideChoice) return undefined;
    if (choice !== undefined && choice !== sameChoice) return choice;
    id = parents.get(id);
  }
  return undefined;
}

// How a category reads in the checklist of one bucket: in it by its own choice, in it through
// its parent (fixed while the parent stays), or elsewhere.
export type CheckState = "own" | "inherited" | "elsewhere";

export function checkState(
  draft: BucketDraft,
  parents: ReadonlyMap<string, string | undefined>,
  categoryId: string,
  bucket: string,
): CheckState {
  if (effectiveChoice(draft, parents, categoryId) !== bucket)
    return "elsewhere";
  return draft.choices.get(categoryId) === bucket ? "own" : "inherited";
}

// The choices after a click on a category in the checklist of bucket: an own category leaves
// it (a top-level one outside the split, a subcategory back to its parent); one elsewhere
// joins it, by following its parent when the parent already draws from it.
export function toggleChoice(
  draft: BucketDraft,
  parents: ReadonlyMap<string, string | undefined>,
  categoryId: string,
  bucket: string,
): Map<string, string> {
  const choices = new Map(draft.choices);
  const state = checkState(draft, parents, categoryId, bucket);
  const parent = parents.get(categoryId);
  const isRoot = draft.roots.has(categoryId) || parent === undefined;
  if (state === "inherited") return choices;
  if (state === "own") {
    choices.set(categoryId, isRoot ? outsideChoice : sameChoice);
    return choices;
  }
  const viaParent =
    !isRoot && effectiveChoice(draft, parents, parent) === bucket;
  choices.set(categoryId, viaParent ? sameChoice : bucket);
  return choices;
}

// The number of open expense categories that draw from each bucket key.
export function bucketCounts(
  draft: BucketDraft,
  parents: ReadonlyMap<string, string | undefined>,
  branches: readonly CategoryBranch[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of branches)
    for (const e of [b.root, ...b.subcategories]) {
      const key = effectiveChoice(draft, parents, e.id);
      if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  return counts;
}

// The number of open expense categories that draw from no bucket, subcategories included: the
// count the plan states for the categories outside the split (A236).
export function outsideCount(
  counts: ReadonlyMap<string, number>,
  branches: readonly CategoryBranch[],
): number {
  let rest = branches.reduce((n, b) => n + 1 + b.subcategories.length, 0);
  for (const n of counts.values()) rest -= n;
  return rest;
}
