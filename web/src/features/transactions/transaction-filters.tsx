import { FilterBar } from "@slotted/react/filter-bar";
import type {
  FilterBarField,
  FilterBarPreset,
} from "@slotted/react/filter-bar";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  filterFields,
  searchFromTree,
  treeFromSearch,
} from "@/features/transactions/filter-tree";
import { periodPresets } from "@/features/transactions/period-presets";
import type {
  TransactionSearch,
  TransactionSearchDraft,
} from "@/features/transactions/search";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

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
  const today = useToday();
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
        key: filterFields.period,
        label: t("transactions.filter.period"),
        kind: "date",
        pinned: true,
        operators: ["between", "after", "before"],
        defaultOperator: "between",
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

  const presets = useMemo<FilterBarPreset[]>(
    () =>
      periodPresets(today).map((p) => ({
        key: p.key,
        label: t(p.label),
        value: treeFromSearch({ from: p.from, to: p.to }),
      })),
    [today, t],
  );
  const { uncategorized, q, ...filtered } = search;
  const preset =
    periodPresets(today).find(
      (p) =>
        Object.keys(filtered).length === 2 &&
        filtered.from === p.from &&
        filtered.to === p.to,
    )?.key ?? null;

  return (
    <FilterBar
      fields={fields}
      value={treeFromSearch(search, (id) => categoryIds.has(id))}
      onValueChange={(tree) => {
        onSearchChange({
          ...searchFromTree(tree, search),
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
      presets={presets}
      preset={preset}
      onPresetChange={(key) => {
        const chosen = periodPresets(today).find((p) => p.key === key);
        onSearchChange({
          ...(uncategorized === undefined ? {} : { uncategorized }),
          ...(q === undefined ? {} : { q }),
          ...(chosen === undefined ? {} : { from: chosen.from, to: chosen.to }),
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
        preset: t("transactions.filter.period"),
        presetNone: t("transactions.period.any"),
      }}
    />
  );
}
