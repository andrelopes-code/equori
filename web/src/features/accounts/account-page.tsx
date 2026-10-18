import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { AccountDialog } from "@/features/accounts/account-dialog";
import { AccountBalances } from "@/features/accounts/account-balances";
import { AccountHistory } from "@/features/accounts/account-history";
import { AccountMenu } from "@/features/accounts/account-menu";
import styles from "@/features/accounts/account-page.module.css";
import { accountsQuery } from "@/features/accounts/api";
import { CloseAccountDialog } from "@/features/accounts/close-account-dialog";
import { AccountsPlaceholder } from "@/features/accounts/accounts-placeholder";
import { TransactionList } from "@/features/transactions";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

type Dialog = "edit" | "close" | null;

export function AccountPage() {
  const t = useT();
  const api = useApi();
  const spaLink = useSpaLink();
  const [locale] = useAppLocale();
  const { id = "" } = useParams({ strict: false });
  const accounts = useQuery(accountsQuery(api));
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = () => {
    setDialog(null);
  };
  const account = accounts.data?.find((a) => a.id === id);
  const newTransaction = `/transactions/new?account_id=${id}`;
  const open =
    account !== undefined && account.closed_on === undefined
      ? account
      : undefined;

  let body;
  if (accounts.isError) {
    body = (
      <QueryError
        error={accounts.error}
        onRetry={() => {
          void accounts.refetch();
        }}
      />
    );
  } else if (accounts.data === undefined) {
    body = <AccountsPlaceholder />;
  } else if (account === undefined) {
    body = (
      <ResultState status="empty" reach="section">
        <ResultStateContent>
          <ResultStateTitle>{t("accounts.notfound")}</ResultStateTitle>
        </ResultStateContent>
      </ResultState>
    );
  } else {
    body = (
      <div className={styles.stack}>
        {account.kind !== undefined && (
          <>
            <AccountBalances account={account} />
            <AccountHistory account={account} />
          </>
        )}
        <Section>
          <SectionHeader>
            <SectionTitle>
              <SectionHeading>{t("nav.transactions")}</SectionHeading>
            </SectionTitle>
          </SectionHeader>
          <SectionBody>
            <TransactionList
              search={{ account_id: account.id }}
              infinite
              emptyActions={
                open !== undefined ? (
                  <ButtonLink
                    {...spaLink(newTransaction)}
                    tone="secondary"
                    variant="outline"
                  >
                    {t("nav.new")}
                  </ButtonLink>
                ) : undefined
              }
            />
          </SectionBody>
        </Section>
      </div>
    );
  }

  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {account?.name ?? t("accounts.title")}
              </PageHeaderHeading>
            </PageHeaderTitle>
            {open !== undefined && (
              <PageHeaderActions>
                <AccountMenu
                  name={open.name}
                  onEdit={() => {
                    setDialog("edit");
                  }}
                  onClose={() => {
                    setDialog("close");
                  }}
                />
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
          {account?.closed_on !== undefined && (
            <PageHeaderDescription>
              {t("accounts.closed.on", {
                date: formatDate(account.closed_on, locale),
              })}
            </PageHeaderDescription>
          )}
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>{body}</PageBody>
      {dialog === "edit" &&
        open !== undefined &&
        accounts.data !== undefined && (
          <AccountDialog
            target={{ mode: "edit", account: open }}
            accounts={accounts.data}
            onClose={closeDialog}
          />
        )}
      {dialog === "close" && open !== undefined && (
        <CloseAccountDialog account={open} onClose={closeDialog} />
      )}
    </Page>
  );
}
