import { useQuery } from "@tanstack/react-query";
import { FilterBar } from "@slotted/react/filter-bar";
import type { FilterBarField } from "@slotted/react/filter-bar";

import { useApi } from "@/api/api-context";
import { BooleanOperand } from "@/features/transactions/boolean-operand";
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
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useViewport } from "@/ui/use-viewport";

const one = ["anyOf"] as const;

export function TransactionFilterBar({
  search,
  onChange,
}: {
  search: TransactionSearch;
  onChange: (next: TransactionSearch) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const phone = useViewport() === "phone";
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data ?? [];
  const payees = useQuery(payeesQuery(api)).data ?? [];
  const tags = useQuery(tagsQuery(api)).data ?? [];
  // A tag in the URL stays selectable when it is no longer in use.
  const tagNames =
    search.tag === undefined || tags.includes(search.tag)
      ? tags
      : [...tags, search.tag];
  // filter-bar.md names no date formatter; a chip writes an operand through its
  // field's option labels, so the URL dates carry labels in the app's format.
  const dates = [search.from, search.to].flatMap((date) =>
    date === undefined
      ? []
      : [{ value: date, label: formatDate(date, locale) }],
  );
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
      options: dates,
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
      // The chip looks a value up among the option labels by identity, so the
      // boolean true carries the word; FilterBarOption types values as strings.
      options: [
        {
          value: true as unknown as string,
          label: t("transactions.filter.uncategorizedYes"),
        },
      ],
    },
  ];
  const tree = treeFromSearch(search);
  // A pinned field keeps its place, so on a phone the active fields come first:
  // the sliding row reads "Filters (n)", the chips, then the empty pills.
  const active = new Set(
    tree?.rules.map((rule) => ("field" in rule ? rule.field : "")),
  );
  const ordered = phone
    ? [
        ...fields.filter((f) => active.has(f.key)),
        ...fields.filter((f) => !active.has(f.key)),
      ]
    : fields;
  return (
    <FilterBar
      fields={ordered}
      value={tree}
      renderOperand={(operand) =>
        operand.field.kind === "boolean" ? (
          <BooleanOperand {...operand} />
        ) : undefined
      }
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
