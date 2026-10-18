import { useParams } from "@tanstack/react-router";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useState } from "react";

import {
  CategorizeDialog,
  categoryPostings,
} from "@/features/transactions/categorize-dialog";
import { NewTransactionPlaceholder } from "@/features/transactions/new-transaction-placeholder";
import { TransactionActions } from "@/features/transactions/transaction-actions";
import { TransactionDetails } from "@/features/transactions/transaction-details";
import { useTransactionData } from "@/features/transactions/use-transaction-data";
import { VersionHistory } from "@/features/transactions/version-history";
import { VoidDialog } from "@/features/transactions/void-dialog";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

export function TransactionPage() {
  const t = useT();
  const { id = "" } = useParams({ strict: false });
  const data = useTransactionData(id);
  const [dialog, setDialog] = useState<"void" | "categorize" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const close = () => {
    setDialog(null);
  };

  let title = t("nav.transactions");
  let actions = null;
  let body;
  if (data.status === "error") {
    body = <QueryError error={data.error} onRetry={data.retry} />;
  } else if (data.status === "loading") {
    body = <NewTransactionPlaceholder />;
  } else {
    const { transaction, accounts, payees, scale } = data;
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    title =
      transaction.description === ""
        ? t("transactions.untitled")
        : transaction.description;
    actions = (
      <TransactionActions
        id={transaction.id}
        voided={transaction.voided_at !== undefined}
        canCategorize={categoryPostings(transaction, accountsById).length > 0}
        onCategorize={() => {
          setDialog("categorize");
        }}
        onVoid={() => {
          setDialog("void");
        }}
        onHistory={() => {
          setHistoryOpen((open) => !open);
        }}
      />
    );
    body = (
      <>
        <TransactionDetails
          transaction={transaction}
          accounts={accounts}
          payees={payees}
          scale={scale}
        />
        {historyOpen && <VersionHistory id={transaction.id} />}
        {dialog === "void" && (
          <VoidDialog transaction={transaction} onClose={close} />
        )}
        {dialog === "categorize" && (
          <CategorizeDialog
            transaction={transaction}
            accounts={accounts}
            scale={scale}
            onClose={close}
          />
        )}
      </>
    );
  }

  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{title}</PageHeaderHeading>
            </PageHeaderTitle>
            <PageHeaderActions>{actions}</PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>{body}</PageBody>
    </Page>
  );
}
