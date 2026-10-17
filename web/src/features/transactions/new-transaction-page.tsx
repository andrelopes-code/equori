import { useQuery } from "@tanstack/react-query";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import {
  instrumentsQuery,
  payeesQuery,
  settingsQuery,
  useScale,
} from "@/features/setup";
import { NewTransactionForm } from "@/features/transactions/new-transaction-form";
import { NewTransactionPlaceholder } from "@/features/transactions/new-transaction-placeholder";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

export function NewTransactionPage() {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const scale = useScale();
  const queries = [accounts, payees, settings, instruments];
  const failed = queries.find((q) => q.isError);
  const baseCurrency = settings.data?.base_currency;

  let body;
  if (failed?.error) {
    body = (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const query of queries) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  } else if (
    accounts.data === undefined ||
    payees.data === undefined ||
    baseCurrency === undefined ||
    scale === null
  ) {
    body = <NewTransactionPlaceholder />;
  } else {
    body = (
      <NewTransactionForm
        accounts={accounts.data}
        payees={payees.data}
        baseCurrency={baseCurrency}
        scale={scale}
      />
    );
  }

  return (
    <Page width="content">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.new")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>{body}</PageBody>
    </Page>
  );
}
