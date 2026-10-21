import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { categoryEntries } from "@/features/categories/category-paths";
import type { CategoryEntry } from "@/features/categories/category-paths";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

const systemWords: Record<string, MessageKey> = {
  uncategorized_expense: "system.uncategorized_expense",
  uncategorized_income: "system.uncategorized_income",
  yield: "system.yield",
  discounts: "system.discounts",
  interest: "system.interest",
  taxes: "system.taxes",
  fees: "system.fees",
  realized_gains: "system.realized_gains",
  realized_losses: "system.realized_losses",
};

// Every category with its path, the system accounts named in the reader's language.
export function useCategoryEntries(
  accounts: readonly Account[] | undefined,
): CategoryEntry[] {
  const t = useT();
  const [locale] = useAppLocale();
  return useMemo(
    () =>
      categoryEntries(accounts ?? [], locale, (role) => {
        const key = systemWords[role];
        return key === undefined ? undefined : t(key);
      }),
    [accounts, locale, t],
  );
}
