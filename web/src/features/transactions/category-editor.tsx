import { useEffect, useState } from "react";

import { CategoryPicker } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";

// The grid's editor for the category cell: choosing a category is the commit.
export function CategoryEditor({
  draft,
  setDraft,
  commit,
  amount,
}: {
  draft: unknown;
  setDraft: (draft: unknown) => void;
  commit: () => void;
  amount: number;
}) {
  const t = useT();
  const [chosen, setChosen] = useState<string | null>(null);
  // Workaround for Slotted finding "A data-grid editor cannot commit the value it sets in the
  // same event": commit reads the edit state the grid stores after its next render.
  useEffect(() => {
    if (chosen === null || draft !== chosen) return;
    const timer = setTimeout(commit, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [chosen, draft, commit]);
  return (
    <CategoryPicker
      aria-label={t("category.label")}
      value={chosen}
      amount={amount}
      size="sm"
      variant="plain"
      autoFocus
      defaultOpen
      onChange={(id) => {
        if (id === null) return;
        setChosen(id);
        setDraft(id);
      }}
    />
  );
}
