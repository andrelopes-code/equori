import { Field, FieldLabel } from "@slotted/react/field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import { useMergeCategory } from "@/features/categories/api";
import { subtreeOf } from "@/features/categories/category-paths";
import type { CategoryEntry } from "@/features/categories/category-paths";
import { CategoryPicker } from "@/features/categories/category-picker";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

// A75: the source's postings, rules and budgets move to the destination, and the source closes.
export function MergeDialog({
  source,
  entries,
  open,
  onOpenChange,
}: {
  source: CategoryEntry;
  entries: readonly CategoryEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const merge = useMergeCategory();
  const [into, setInto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const excluded = subtreeOf(entries, source.id);

  function handleConfirm() {
    if (into === null) return;
    setError(null);
    merge
      .mutateAsync({ id: source.id, into })
      .then(() => {
        onOpenChange(false);
      })
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      open={open}
      title={t("merge.title", { name: source.path })}
      description={t("merge.description")}
      confirmLabel={t("merge.confirm")}
      confirmDisabled={into === null}
      pending={merge.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={() => {
        onOpenChange(false);
      }}
    >
      <Field required>
        <FieldLabel>{t("merge.into")}</FieldLabel>
        <CategoryPicker
          value={into}
          amount={source.class === "income" ? 1 : -1}
          exclude={excluded}
          portal={false}
          onChange={setInto}
        />
      </Field>
    </ConfirmDialog>
  );
}
