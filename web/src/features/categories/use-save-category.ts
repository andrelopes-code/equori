import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { settingsQuery } from "@/features/setup";
import {
  useCategoryAppearance,
  useCreateCategory,
  useMoveCategory,
  useRenameCategory,
} from "@/features/categories/api";
import type {
  CategoryClass,
  CategoryEntry,
  CategoryIconName,
} from "@/features/categories/category-paths";
import { useT } from "@/i18n/i18n-provider";

export interface CategoryDraft {
  name: string;
  cls: CategoryClass;
  parent: string | null;
  color: number | null;
  icon: CategoryIconName | null;
}

// Writes the dialog's draft: one create, or one request per changed fact of an edited category.
export function useSaveCategory(
  editing: CategoryEntry | null,
  onSaved: () => void,
) {
  const t = useT();
  const api = useApi();
  const settings = useQuery(settingsQuery(api));
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const move = useMoveCategory();
  const appearance = useCategoryAppearance();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);

  const busy =
    create.isPending ||
    rename.isPending ||
    move.isPending ||
    appearance.isPending;

  const save = async ({ name, cls, parent, color, icon }: CategoryDraft) => {
    setErrors({});
    setSummary(null);
    const trimmed = name.trim();
    if (trimmed === "") {
      setErrors({ name: t("category.nameRequired") });
      return;
    }

    try {
      if (editing === null) {
        const currency = settings.data?.base_currency;
        if (currency === undefined) return;
        await create.mutateAsync({
          name: trimmed,
          class: cls,
          currency,
          ...(parent === null ? {} : { parent_id: parent }),
          ...(color === null ? {} : { color }),
          ...(icon === null ? {} : { icon }),
        });
      } else {
        if (trimmed !== editing.name) {
          await rename.mutateAsync({ id: editing.id, name: trimmed });
        }
        if (parent !== (editing.parentId ?? null)) {
          await move.mutateAsync({ id: editing.id, parentId: parent });
        }
        if (
          color !== (editing.color ?? null) ||
          icon !== (editing.icon ?? null)
        ) {
          await appearance.mutateAsync({ id: editing.id, color, icon });
        }
      }
      onSaved();
    } catch (error) {
      if (error instanceof ProblemError) {
        const byField = fieldErrors(error.problem);
        setErrors({
          ...(byField.name === undefined ? {} : { name: byField.name }),
          ...(byField.parent_id === undefined
            ? {}
            : { parent: byField.parent_id }),
        });
      }
      setSummary(errorText(error, t));
    }
  };

  return { save, busy, errors, summary };
}
