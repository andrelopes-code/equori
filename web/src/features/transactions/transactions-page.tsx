import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button, ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@slotted/react/link";

import { useApi } from "@/api/api-context";
import { uncategorizedCountQuery } from "@/features/transactions/api";
import { validateTransactionsPageSearch } from "@/features/transactions/search";
import { TransactionPane } from "@/features/transactions/transaction-pane";
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
  const { selected, ...search } = validateTransactionsPageSearch(
    useSearch({ strict: false }),
  );
  const filtered = Object.keys(search).length > 0;
  const { data: uncategorized } = useQuery(uncategorizedCountQuery(useApi()));
  const review =
    uncategorized === undefined || uncategorized.count === 0
      ? undefined
      : uncategorized.more
        ? `${String(uncategorized.count)}+`
        : String(uncategorized.count);

  const change = (next: TransactionSearch) => {
    void navigate({ to: "/transactions", search: next });
  };
  // Complete frontend T1: from 1024 px a row opens beside the table.
  const select =
    viewport === "desktop"
      ? (id: string) => {
          void navigate({
            to: "/transactions",
            search: { ...search, selected: id },
          });
        }
      : undefined;

  return (
    <Page width="bleed" fill>
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.transactions")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {review === undefined || search.uncategorized === true ? (
                  t("transactions.subtitle")
                ) : (
                  <Link
                    {...spaLink("/transactions?uncategorized=true")}
                    variant="neutral"
                  >
                    {t("transactions.subtitle.review", { count: review })}
                  </Link>
                )}
              </PageHeaderSubheading>
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
          <div
            className={styles.split}
            data-open={
              select !== undefined && selected !== undefined ? "" : undefined
            }
          >
            <div className={styles.listing}>
              <TransactionList
                search={search}
                infinite
                {...(select === undefined ? {} : { onSelect: select })}
                {...(selected === undefined ? {} : { selected })}
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
            {select !== undefined && selected !== undefined && (
              <TransactionPane key={selected} id={selected} />
            )}
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
