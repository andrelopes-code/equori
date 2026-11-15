import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { CategoryEntry } from "@/features/categories";
import styles from "@/features/planning/budget-plan/bucket-dialog.module.css";
import type { Choice } from "@/ui/form-fields/choice-select";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { useT } from "@/i18n/i18n-provider";

interface BucketCategoryRowProps {
  root: CategoryEntry;
  subcategories: readonly CategoryEntry[];
  // The buckets of the draft as choices.
  buckets: readonly Choice[];
  choices: ReadonlyMap<string, string>;
  outside: string;
  same: string;
  onChoose: (categoryId: string, choice: string) => void;
}

// A top-level category with its bucket and, behind a disclosure, its subcategories, each
// following it unless placed in a bucket of its own (income buckets A229).
export function BucketCategoryRow({
  root,
  subcategories,
  buckets,
  choices,
  outside,
  same,
  onChoose,
}: BucketCategoryRowProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootChoices = [
    ...buckets,
    { value: outside, label: t("buckets.outside") },
  ];
  const childChoices = [
    { value: same, label: t("buckets.option.same", { name: root.name }) },
    ...buckets,
  ];

  return (
    <Stack gap={1}>
      <div className={styles.categoryRow}>
        <Text size="sm" className={styles.categoryName}>
          {root.name}
        </Text>
        <ChoiceSelect
          label={root.name}
          multiple={false}
          value={choices.get(root.id) ?? outside}
          choices={rootChoices}
          onChange={(next) => {
            if (typeof next === "string") onChoose(root.id, next);
          }}
        />
      </div>

      {subcategories.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {t("buckets.subcategories", { name: root.name })}
        </Button>
      )}
      {open && (
        <Stack gap={1} className={styles.children}>
          {subcategories.map((child) => (
            <div key={child.id} className={styles.categoryRow}>
              <Text size="sm" className={styles.categoryName}>
                {child.name}
              </Text>
              <ChoiceSelect
                label={child.path}
                multiple={false}
                value={choices.get(child.id) ?? same}
                choices={childChoices}
                onChange={(next) => {
                  if (typeof next === "string") onChoose(child.id, next);
                }}
              />
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
