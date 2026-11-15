import { Checkbox } from "@slotted/react/checkbox";
import { Text } from "@slotted/react/typography";

import type { CategoryEntry } from "@/features/categories";
import styles from "@/features/planning/income-split/bucket-categories.module.css";
import {
  checkState,
  effectiveChoice,
  outsideChoice,
  toggleChoice,
} from "@/features/planning/income-split/bucket-draft";
import type {
  BucketDraft,
  CategoryBranch,
} from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

interface BucketChecklistProps {
  draft: BucketDraft;
  branches: readonly CategoryBranch[];
  parents: ReadonlyMap<string, string | undefined>;
  outside: readonly CategoryEntry[];
  // A bucket key, or outsideChoice for the categories without a bucket.
  selected: string | undefined;
  onChoices: (choices: Map<string, string>) => void;
}

// The categories checked for the chosen bucket. A subcategory that follows a checked parent
// is checked and fixed; a category of another bucket names it and moves here on a click.
export function BucketChecklist({
  draft,
  branches,
  parents,
  outside,
  selected,
  onChoices,
}: BucketChecklistProps) {
  const t = useT();
  if (selected === undefined) return null;

  if (selected === outsideChoice)
    return (
      <div className={styles.list}>
        <Text size="sm" tone="muted">
          {outside.length === 0
            ? t("buckets.noneOutside")
            : t("buckets.unplacedHint")}
        </Text>
        {outside.map((e) => (
          <div key={e.id} className={styles.item}>
            <Text size="sm" className={styles.label}>
              {e.name}
            </Text>
          </div>
        ))}
      </div>
    );

  const name = draft.buckets.find((b) => b.key === selected)?.name ?? "";
  const all = branches.flatMap((b) => [b.root, ...b.subcategories]);
  const byId = new Map(all.map((e) => [e.id, e]));
  const nameOf = (key: string | undefined) =>
    draft.buckets.find((b) => b.key === key)?.name ?? t("buckets.unplaced");

  return (
    <div className={styles.list}>
      <Text size="sm" tone="muted">
        {t("buckets.checklist", { name })}
      </Text>
      {all.map((e) => {
        const state = checkState(draft, parents, e.id, selected);
        const parentName =
          e.parentId === undefined ? "" : (byId.get(e.parentId)?.name ?? "");
        return (
          <div
            key={e.id}
            className={styles.item}
            style={{ paddingInlineStart: `${String(e.depth * 1.5)}rem` }}
          >
            <Checkbox
              className={styles.label}
              checked={state !== "elsewhere"}
              disabled={state === "inherited"}
              onCheckedChange={() => {
                onChoices(toggleChoice(draft, parents, e.id, selected));
              }}
            >
              {e.name}
            </Checkbox>
            {state === "inherited" && (
              <Text size="xs" tone="muted">
                {t("buckets.follows", { name: parentName })}
              </Text>
            )}
            {state === "elsewhere" && (
              <Text size="xs" tone="muted">
                {t("buckets.inBucket", {
                  name: nameOf(effectiveChoice(draft, parents, e.id)),
                })}
              </Text>
            )}
          </div>
        );
      })}
    </div>
  );
}
