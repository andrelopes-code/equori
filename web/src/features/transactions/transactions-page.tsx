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

import { ActiveFilters } from "@/features/transactions/active-filters";
import { FilterDrawer } from "@/features/transactions/filter-drawer";
import { FilterFields } from "@/features/transactions/filter-fields";
import { SearchForm } from "@/features/transactions/search-form";
import {
  patchSearch,
  validateTransactionSearch,
} from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import { TransactionList } from "@/features/transactions/transaction-list";
import styles from "@/features/transactions/transactions-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

export function TransactionsPage() {
  const t = useT();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const navigate = useNavigate();
  const search = validateTransactionSearch(useSearch({ strict: false }));
  const phone = viewport === "phone";
  const filtered = Object.keys(search).length > 0;

  const change = (next: TransactionSearch) => {
    void navigate({ to: "/transactions", search: next });
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
                <FilterDrawer search={search} onChange={change} />
              ) : (
                <ButtonLink {...spaLink("/transactions/new")}>
                  {t("nav.new")}
                </ButtonLink>
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
          <div className={styles.controls}>
            <SearchForm
              q={search.q}
              onSubmit={(q) => {
                change(patchSearch(search, { q }));
              }}
            />
            {!phone && (
              <div className={styles.fields}>
                <FilterFields search={search} onChange={change} />
              </div>
            )}
            <ActiveFilters search={search} onChange={change} />
          </div>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.scroller}>
          <TransactionList
            search={search}
            infinite
            emptyActions={
              filtered ? (
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
