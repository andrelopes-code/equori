import { Text } from "@slotted/react/typography";

import type { CategoryView } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";

// The rule of the chosen view, in one sentence.
export function CategoryViewNote({ view }: { view: CategoryView }) {
  const t = useT();
  return (
    <Text size="sm" tone="muted">
      {t(view === "cash" ? "view.cash.rule" : "view.accrual.rule")}
    </Text>
  );
}
