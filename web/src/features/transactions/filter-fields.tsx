import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { payeesQuery } from "@/features/setup";
import { tagsQuery } from "@/features/transactions/api";
import { FilterSelect } from "@/features/transactions/filter-select";
import { patchSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import { useT } from "@/i18n/i18n-provider";

export function FilterFields({
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
  return (
    <>
      <FilterSelect
        label={t("transactions.filter.account")}
        value={search.account_id}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={(account_id) => {
          onChange(patchSearch(search, { account_id }));
        }}
      />
      <FilterSelect
        label={t("transactions.filter.payee")}
        value={search.payee_id}
        options={payees.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(payee_id) => {
          onChange(patchSearch(search, { payee_id }));
        }}
      />
      <FilterSelect
        label={t("transactions.filter.tag")}
        value={search.tag}
        options={tagNames.map((name) => ({ value: name, label: name }))}
        onChange={(tag) => {
          onChange(patchSearch(search, { tag }));
        }}
      />
      <Field>
        <FieldLabel>{t("transactions.filter.from")}</FieldLabel>
        <TextField
          type="date"
          value={search.from ?? ""}
          onValueChange={(value) => {
            onChange(patchSearch(search, { from: value }));
          }}
        />
      </Field>
      <Field>
        <FieldLabel>{t("transactions.filter.to")}</FieldLabel>
        <TextField
          type="date"
          value={search.to ?? ""}
          onValueChange={(value) => {
            onChange(patchSearch(search, { to: value }));
          }}
        />
      </Field>
      <Checkbox
        checked={search.uncategorized === true}
        onCheckedChange={(checked) => {
          onChange(patchSearch(search, { uncategorized: checked }));
        }}
      >
        {t("transactions.filter.uncategorized")}
      </Checkbox>
    </>
  );
}
