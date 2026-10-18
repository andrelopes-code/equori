import { useParams } from "@tanstack/react-router";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { CorrectTransactionForm } from "@/features/transactions/correct-transaction-form";
import { NewTransactionPlaceholder } from "@/features/transactions/new-transaction-placeholder";
import { useTransactionData } from "@/features/transactions/use-transaction-data";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

export function CorrectTransactionPage() {
  const t = useT();
  const { id = "" } = useParams({ strict: false });
  const data = useTransactionData(id);

  let body;
  if (data.status === "error") {
    body = <QueryError error={data.error} onRetry={data.retry} />;
  } else if (data.status === "loading") {
    body = <NewTransactionPlaceholder />;
  } else {
    body = (
      <CorrectTransactionForm
        transaction={data.transaction}
        accounts={data.accounts}
        payees={data.payees}
        baseCurrency={data.baseCurrency}
        scale={data.scale}
      />
    );
  }

  return (
    <Page width="content">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {t("transaction.correct.title")}
              </PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>{body}</PageBody>
    </Page>
  );
}
