import { useParams } from "@tanstack/react-router";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { ButtonLink } from "@slotted/react/button";
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
import styles from "@/features/transactions/transaction-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";
import { useSpaLink } from "@/ui/use-spa-link";

export function CorrectTransactionPage() {
  const t = useT();
  const { id = "" } = useParams({ strict: false });
  const data = useTransactionData(id);
  const spaLink = useSpaLink();

  let body;
  if (data.status === "error") {
    body = <QueryError error={data.error} onRetry={data.retry} />;
  } else if (data.status === "loading") {
    body = <NewTransactionPlaceholder />;
  } else {
    body =
      data.transaction.voided_at === undefined ? (
        <CorrectTransactionForm
          transaction={data.transaction}
          accounts={data.accounts}
          payees={data.payees}
          baseCurrency={data.baseCurrency}
          scale={data.scale}
        />
      ) : (
        <div className={styles.details}>
          <Alert tone="warning">
            <AlertContent>
              <AlertDescription>
                {t("transaction.correct.voided")}
              </AlertDescription>
            </AlertContent>
          </Alert>
          <div>
            <ButtonLink
              {...spaLink(`/transactions/${data.transaction.id}`)}
              tone="secondary"
              variant="outline"
            >
              {t("transaction.correct.back")}
            </ButtonLink>
          </div>
        </div>
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
