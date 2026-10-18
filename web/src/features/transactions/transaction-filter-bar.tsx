import { useQuery } from "@tanstack/react-query";
import { FilterBar } from "@slotted/react/filter-bar";
import type { FilterBarField } from "@slotted/react/filter-bar";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery } from "@/features/setup";
import { tagsQuery } from "@/features/transactions/api";
import {
  filterFields,
  searchFromTree,
  treeFromSearch,
} from "@/features/transactions/filter-tree";
import { patchSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import { useT } from "@/i18n/i18n-provider";

const one = ["anyOf"] as const;

export function TransactionFilterBar({
  search,
  onChange,
}: {
  search: TransactionSearch;
  onChange: (next: TransactionSearch) => void;
}) {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data ?? [];
  const payees = useQuery(payeesQuery(api)).data ?? [];
  const tags = useQuery(tagsQuery(api)).data ?? [];
  // A tag in the URL stays selectable when it is no longer in use.
  const tagNames =
    search.tag === undefined || tags.includes(search.tag)
      ? tags
      : [...tags, search.tag];
  const fields: FilterBarField[] = [
    {
      key: filterFields.account,
      label: t("transactions.filter.account"),
      kind: "set",
      operators: one,
      pinned: true,
      options: accounts.map((a) => ({ value: a.id, label: a.name })),
    },
    {
      key: filterFields.period,
      label: t("transactions.filter.period"),
      kind: "date",
      operators: ["between", "after", "before"],
      defaultOperator: "between",
      pinned: true,
    },
    {
      key: filterFields.payee,
      label: t("transactions.filter.payee"),
      kind: "set",
      operators: one,
      pinned: true,
      options: payees.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      key: filterFields.tag,
      label: t("transactions.filter.tag"),
      kind: "set",
      operators: one,
      pinned: true,
      options: tagNames.map((name) => ({ value: name, label: name })),
    },
    {
      key: filterFields.uncategorized,
      label: t("transactions.filter.uncategorized"),
      kind: "boolean",
      operators: ["is"],
      pinned: true,
    },
  ];
  return (
    <FilterBar
      fields={fields}
      value={treeFromSearch(search)}
      onValueChange={(tree) => {
        onChange(searchFromTree(tree, search));
      }}
      query={search.q ?? ""}
      onQueryChange={(q) => {
        onChange(patchSearch(search, { q }));
      }}
      messages={{
        search: t("transactions.search"),
        operators: {
          after: t("transactions.filter.onOrAfter"),
          before: t("transactions.filter.onOrBefore"),
        },
      }}
    />
  );
}
