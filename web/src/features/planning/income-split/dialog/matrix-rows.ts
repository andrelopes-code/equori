import type { CategoryEntry } from "@/features/categories";
import {
  checkState,
  effectiveChoice,
  outsideChoice,
  sameChoice,
  toggleChoice,
} from "@/features/planning/income-split/bucket-draft";
import type {
  BucketDraft,
  CategoryBranch,
} from "@/features/planning/income-split/bucket-draft";

type Parents = ReadonlyMap<string, string | undefined>;

export interface MatrixRow {
  entry: CategoryEntry;
  // Zero for a top-level category.
  depth: number;
  // The column of the mark: a bucket key, or outsideChoice.
  at: string;
  // A subcategory without a bucket of its own.
  follows: boolean;
  // Of a top-level category: its subcategories per column other than its own.
  more: ReadonlyMap<string, number>;
  subcategories: number;
  open: boolean;
  // The row holds the column of the categories without a bucket.
  canOutside: boolean;
}

// The rows of the categories matrix (dialog spec A250): each top-level category, and under an
// open one its subcategories.
export function matrixRows(
  draft: BucketDraft,
  branches: readonly CategoryBranch[],
  parents: Parents,
  open: ReadonlySet<string>,
): MatrixRow[] {
  const column = (id: string | undefined) =>
    id === undefined
      ? outsideChoice
      : (effectiveChoice(draft, parents, id) ?? outsideChoice);

  return branches.flatMap((branch) => {
    const at = column(branch.root.id);
    const isOpen = open.has(branch.root.id);
    const root: MatrixRow = {
      entry: branch.root,
      depth: 0,
      at,
      follows: false,
      more: subcategoriesElsewhere(branch, at, column),
      subcategories: branch.subcategories.length,
      open: isOpen,
      canOutside: true,
    };
    if (!isOpen) return [root];

    const below = branch.subcategories.map((entry) => ({
      entry,
      depth: entry.depth - branch.root.depth,
      at: column(entry.id),
      follows: !isBucket(draft.choices.get(entry.id)),
      more: new Map<string, number>(),
      subcategories: 0,
      open: false,
      canOutside: column(entry.parentId) === outsideChoice,
    }));

    return [root, ...below];
  });
}

// The choices after a click on a column of a category's row (dialog spec A250): a top-level
// category takes the column; a subcategory takes a bucket of its own, or follows its parent
// again on the parent's column.
export function pickChoice(
  draft: BucketDraft,
  parents: Parents,
  categoryId: string,
  column: string,
): Map<string, string> {
  if (column !== outsideChoice) {
    const elsewhere =
      checkState(draft, parents, categoryId, column) === "elsewhere";

    return elsewhere
      ? toggleChoice(draft, parents, categoryId, column)
      : new Map(draft.choices);
  }

  const choices = new Map(draft.choices);
  const parent = parents.get(categoryId);
  if (draft.roots.has(categoryId) || parent === undefined) {
    choices.set(categoryId, outsideChoice);

    return choices;
  }

  if (effectiveChoice(draft, parents, parent) === undefined)
    choices.set(categoryId, sameChoice);

  return choices;
}

function subcategoriesElsewhere(
  branch: CategoryBranch,
  at: string,
  column: (id: string) => string,
): Map<string, number> {
  const more = new Map<string, number>();
  for (const sub of branch.subcategories) {
    const key = column(sub.id);
    if (key !== at) more.set(key, (more.get(key) ?? 0) + 1);
  }

  return more;
}

function isBucket(choice: string | undefined): boolean {
  return (
    choice !== undefined && choice !== sameChoice && choice !== outsideChoice
  );
}
