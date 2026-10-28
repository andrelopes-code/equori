import { CategoryPicker } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";

// The grid's editor for the category cell: choosing a category is the commit.
export function CategoryEditor({
  setDraft,
  commit,
  amount,
}: {
  setDraft: (draft: unknown) => void;
  commit: () => void;
  amount: number;
}) {
  const t = useT();
  return (
    <CategoryPicker
      aria-label={t("category.label")}
      value={null}
      amount={amount}
      size="sm"
      variant="plain"
      autoFocus
      defaultOpen
      onChange={(id) => {
        if (id === null) return;
        setDraft(id);
        commit();
      }}
    />
  );
}
