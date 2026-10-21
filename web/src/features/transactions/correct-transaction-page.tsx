import { Page, PageBody } from "@slotted/react/page";
import { SkeletonText } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { tagsQuery } from "@/features/transactions/api";
import { CorrectionForm } from "@/features/transactions/correction-form";
import { TransactionDetail } from "@/features/transactions/transaction-detail";
import { useTransactionData } from "@/features/transactions/use-transaction-data";

export function CorrectTransactionPage() {
  const { id } = useParams({ from: "/_authed/transactions/$id/correct" });
  const api = useApi();
  const data = useTransactionData(id);
  const tags = useQuery(tagsQuery(api));
  // A missing, failed or voided transaction reads as its own page, which says why.
  if (
    data.status === "error" ||
    (data.status === "ready" && data.transaction.voided_at !== undefined)
  ) {
    return (
      <Page width="wide">
        <PageBody>
          <TransactionDetail id={id} host="page" />
        </PageBody>
      </Page>
    );
  }
  if (data.status === "loading") {
    return (
      <Page width="wide" loading>
        <PageBody>
          <SkeletonText lines={6} />
        </PageBody>
      </Page>
    );
  }
  return (
    <CorrectionForm
      key={data.transaction.id}
      transaction={data.transaction}
      accounts={data.accounts}
      payees={data.payees}
      tags={tags.data ?? []}
      baseCurrency={data.baseCurrency}
      scale={data.scale}
    />
  );
}
