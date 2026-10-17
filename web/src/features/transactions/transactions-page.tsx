import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button, ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tag, TagGroup } from "@slotted/react/tag";
import { TextField } from "@slotted/react/text-field";
import type { SubmitEvent } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  FilterDrawer,
  FilterFields,
  patchSearch,
} from "@/features/transactions/filter-drawer";
import { validateTransactionSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import { TransactionList } from "@/features/transactions/transaction-list";
import styles from "@/features/transactions/transactions-page.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

const maxQueryLength = 100;

interface ActiveFilter {
  key: keyof TransactionSearch;
  label: MessageKey;
  value?: string;
}

function activeFilters(
  search: TransactionSearch,
  accountName: (id: string) => string,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  if (search.account_id !== undefined) {
    filters.push({
      key: "account_id",
      label: "transactions.tag.account",
      value: accountName(search.account_id),
    });
  }
  if (search.payee_id !== undefined) {
    filters.push({ key: "payee_id", label: "transactions.tag.payee" });
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
    });
  }
  if (search.q !== undefined) {
    filters.push({ key: "q", label: "transactions.tag.q", value: search.q });
  }
  return filters;
}

export function TransactionsPage() {
  const t = useT();
  const api = useApi();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const navigate = useNavigate();
  const search = validateTransactionSearch(useSearch({ strict: false }));
  const accounts = useQuery(accountsQuery(api)).data ?? [];
  const phone = viewport === "phone";

  const change = (next: TransactionSearch) => {
    void navigate({ to: "/transactions", search: next });
  };
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id;
  const active = activeFilters(search, accountName);

  const submitSearch = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    change(patchSearch(search, { q }));
  };

  return (
    <Page width="bleed" fill>
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.transactions")}</PageHeaderHeading>
            </PageHeaderTitle>
            <PageHeaderActions>
              {phone ? (
                <FilterDrawer
                  search={search}
                  accounts={accounts}
                  onChange={change}
                />
              ) : (
                <ButtonLink {...spaLink("/transactions/new")}>
                  {t("nav.new")}
                </ButtonLink>
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
          <div className={styles.controls}>
            <form
              key={search.q ?? ""}
              role="search"
              className={styles.search}
              onSubmit={submitSearch}
            >
              <TextField
                type="search"
                name="q"
                maxLength={maxQueryLength}
                defaultValue={search.q ?? ""}
                aria-label={t("transactions.search")}
              />
              <Button type="submit" tone="secondary" variant="outline">
                {t("transactions.search.submit")}
              </Button>
            </form>
            {!phone && (
              <div className={styles.fields}>
                <FilterFields
                  search={search}
                  accounts={accounts}
                  onChange={change}
                />
              </div>
            )}
            {active.length > 0 && (
              <TagGroup aria-label={t("transactions.filters.active")}>
                {active.map(({ key, label, value }) => (
                  <Tag
                    key={key}
                    onRemove={() => {
                      change(patchSearch(search, { [key]: undefined }));
                    }}
                  >
                    {t(label, { value: value ?? "" })}
                  </Tag>
                ))}
              </TagGroup>
            )}
          </div>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.scroller}>
          <TransactionList
            search={search}
            infinite
            emptyActions={
              active.length > 0 ? (
                <Button
                  tone="secondary"
                  variant="outline"
                  onClick={() => {
                    change({});
                  }}
                >
                  {t("transactions.filters.clear")}
                </Button>
              ) : (
                <ButtonLink {...spaLink("/transactions/new")}>
                  {t("nav.new")}
                </ButtonLink>
              )
            }
          />
        </div>
      </PageBody>
    </Page>
  );
}
