import { FilterBar } from "@slotted/react/filter-bar";
import type { FilterBarField } from "@slotted/react/filter-bar";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  filterFields,
  searchFromTree,
  treeFromSearch,
} from "@/features/transactions/filter-tree";
import type {
  TransactionSearch,
  TransactionSearchDraft,
} from "@/features/transactions/search";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Payee = components["schemas"]["Payee"];

export function TransactionFilters({
  search,
  onSearchChange,
  accounts,
  categories,
  payees,
  tags,
  count,
  hasMore,
  loading,
}: {
  search: TransactionSearch;
  onSearchChange: (next: TransactionSearchDraft) => void;
  accounts: readonly Account[];
  categories: readonly CategoryEntry[];
  payees: readonly Payee[];
  tags: readonly string[];
  count: number | undefined;
  hasMore: boolean;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const categoryIds = useMemo(
    () => new Set(categories.map((c) => c.id)),
    [categories],
  );

  const fields = useMemo<FilterBarField[]>(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    const balance = accounts
      .filter(
        (a) =>
          (a.class === "asset" || a.class === "liability") &&
          a.closed_on === undefined &&
          a.system_role === undefined,
      )
      .sort((a, b) => collator.compare(a.name, b.name));
    return [
      {
        key: filterFields.account,
        label: t("transactions.filter.account"),
        kind: "set",
        pinned: true,
        options: balance.map((a) => ({ value: a.id, label: a.name })),
      },
      {
        key: filterFields.category,
        label: t("transactions.filter.category"),
        kind: "set",
        pinned: true,
        options: categories
          .filter((c) => !c.archived)
          .map((c) => ({ value: c.id, label: c.path })),
      },
      {
        key: filterFields.payee,
        label: t("transactions.filter.payee"),
        kind: "set",
        options: [...payees]
          .sort((a, b) => collator.compare(a.name, b.name))
          .map((p) => ({ value: p.id, label: p.name })),
      },
      {
        key: filterFields.tag,
        label: t("transactions.filter.tag"),
        kind: "set",
        options: tags.map((tag) => ({ value: tag, label: tag })),
      },
    ];
  }, [accounts, categories, payees, tags, t, locale]);

  // The period is the header's control (PeriodControl); the bar holds the other filters.
  const { uncategorized, q, from, to, ...filtered } = search;
  const period = {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  };

  return (
    <FilterBar
      fields={fields}
      // The queue is the page's place, set by the header tabs, never a pill (LP-09).
      value={treeFromSearch(
        { ...filtered, ...(q === undefined ? {} : { q }) },
        (id) => categoryIds.has(id),
      )}
      onValueChange={(tree) => {
        onSearchChange({
          ...searchFromTree(tree, search),
          ...period,
          ...(uncategorized === undefined ? {} : { uncategorized }),
        });
      }}
      query={q ?? ""}
      onQueryChange={(next) => {
        const text = next.trim();
        onSearchChange({
          ...search,
          ...(text === "" ? { q: undefined } : { q: text }),
        });
      }}
      shortcut="/"
      loading={loading}
      {...(count === undefined ? {} : { count })}
      messages={{
        countOnly: hasMore
          ? t("transactions.countMore")
          : t("transactions.count"),
        search: t("transactions.search"),
      }}
    />
  );
}
