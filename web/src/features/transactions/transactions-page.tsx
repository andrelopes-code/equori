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

import { validateTransactionSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import { TransactionFilterBar } from "@/features/transactions/transaction-filter-bar";
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
            {/* Ledger sheet L5: from 600 px the top bar holds New. */}
            {viewport === "phone" && (
              <PageHeaderActions>
                <ButtonLink
                  {...spaLink("/transactions/new")}
                  tone="secondary"
                  size="sm"
                >
                  {t("nav.entry")}
                </ButtonLink>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.region}>
          <TransactionFilterBar search={search} onChange={change} />
          <div className={styles.listing}>
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
                  <ButtonLink
                    {...spaLink("/transactions/new")}
                    tone="secondary"
                    variant="outline"
                  >
                    {t("nav.new")}
                  </ButtonLink>
                )
              }
            />
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
