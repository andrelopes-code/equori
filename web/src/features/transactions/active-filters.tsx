import { useQuery } from "@tanstack/react-query";
import { Tag, TagGroup } from "@slotted/react/tag";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery } from "@/features/setup";
import { patchSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

interface ActiveFilter {
  key: keyof TransactionSearch;
  label: MessageKey;
  value: string;
}

export function ActiveFilters({
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
  const filters: ActiveFilter[] = [];
  if (search.account_id !== undefined) {
    const id = search.account_id;
    filters.push({
      key: "account_id",
      label: "transactions.tag.account",
      value: accounts.find((a) => a.id === id)?.name ?? id,
    });
  }
  if (search.payee_id !== undefined) {
    const id = search.payee_id;
    filters.push({
      key: "payee_id",
      label: "transactions.tag.payee",
      value: payees.find((p) => p.id === id)?.name ?? id,
    });
  }
  if (search.tag !== undefined) {
    filters.push({
      key: "tag",
      label: "transactions.tag.tag",
      value: search.tag,
    });
  }
  if (search.from !== undefined) {
    filters.push({
      key: "from",
      label: "transactions.tag.from",
      value: search.from,
    });
  }
  if (search.to !== undefined) {
    filters.push({ key: "to", label: "transactions.tag.to", value: search.to });
  }
  if (search.uncategorized === true) {
    filters.push({
      key: "uncategorized",
      label: "transactions.tag.uncategorized",
      value: "",
    });
  }
  if (search.q !== undefined) {
    filters.push({ key: "q", label: "transactions.tag.q", value: search.q });
  }
  if (filters.length === 0) return null;
  return (
    <TagGroup aria-label={t("transactions.filters.active")}>
      {filters.map(({ key, label, value }) => (
        <Tag
          key={key}
          onRemove={() => {
            onChange(patchSearch(search, { [key]: undefined }));
          }}
        >
          {t(label, { value })}
        </Tag>
      ))}
    </TagGroup>
  );
}
