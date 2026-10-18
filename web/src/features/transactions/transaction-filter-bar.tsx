import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { FilterChoiceMenu } from "@/features/transactions/filter-choice-menu";
import { FilterPeriod } from "@/features/transactions/filter-period";
import { FilterSearchField } from "@/features/transactions/filter-search-field";
import { payeesQuery } from "@/features/setup";
import { tagsQuery } from "@/features/transactions/api";
import { patchSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import styles from "@/features/transactions/transaction-filter-bar.module.css";
import { useT } from "@/i18n/i18n-provider";

// The search field, then the filters as words: Account, Period, Payee, Tag and Uncategorized.
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
  const patch = (next: Record<string, unknown>) => {
    onChange(patchSearch(search, next));
  };
  return (
    <div className={styles.bar} role="search">
      <FilterSearchField
        query={search.q ?? ""}
        onSubmit={(q) => {
          patch({ q });
        }}
      />
      <div className={styles.words}>
        <FilterChoiceMenu
          name={t("transactions.filter.account")}
          choices={accounts.map((a) => ({ value: a.id, label: a.name }))}
          value={search.account_id}
          onChange={(account_id) => {
            patch({ account_id });
          }}
        />
        <FilterPeriod
          period={{ from: search.from, to: search.to }}
          onChange={(period) => {
            patch({ from: period.from, to: period.to });
          }}
        />
        <FilterChoiceMenu
          name={t("transactions.filter.payee")}
          choices={payees.map((p) => ({ value: p.id, label: p.name }))}
          value={search.payee_id}
          onChange={(payee_id) => {
            patch({ payee_id });
          }}
        />
        <FilterChoiceMenu
          name={t("transactions.filter.tag")}
          choices={tagNames.map((name) => ({ value: name, label: name }))}
          value={search.tag}
          onChange={(tag) => {
            patch({ tag });
          }}
        />
        <span className={styles.word}>
          <button
            type="button"
            className={styles.trigger}
            aria-pressed={search.uncategorized === true}
            onClick={() => {
              patch({
                uncategorized: search.uncategorized === true ? undefined : true,
              });
            }}
          >
            {t("transactions.filter.uncategorized")}
          </button>
        </span>
      </div>
    </div>
  );
}
